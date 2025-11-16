// app/api/hourly-productions/route.js
import { dbConnect } from "@/services/mongo";
import { ProductionHeaderModel } from "@/models/ProductionHeader-model";
import { HourlyProductionModel } from "@/models/HourlyProduction-model";

// 🔹 helper for safe number parsing
function toNumberOrZero(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

// 🔹 Compute base hourly target
// Prefer: todayTarget / workingHour (if available)
// Fallback: (manpower * 60 * planEff% / 100) / SMV
function computeBaseTargetPerHour(header) {
  const workingHour = toNumberOrZero(header.workingHour);
  const todayTarget = toNumberOrZero(header.todayTarget);
  const manpowerPresent = toNumberOrZero(header.manpowerPresent);
  const smv = toNumberOrZero(header.smv);
  const planEfficiencyPercent = toNumberOrZero(header.planEfficiency);
  const planEffDecimal = planEfficiencyPercent / 100;

  const targetFromTodayTarget =
    workingHour > 0 ? todayTarget / workingHour : 0;

  const targetFromCapacity =
    manpowerPresent > 0 && smv > 0
      ? (manpowerPresent * 60 * planEffDecimal) / smv
      : 0;

  return targetFromTodayTarget || targetFromCapacity || 0;
}

// 🔸 GET /api/hourly-productions?headerId=...&productionUserId=...
export async function GET(request) {
  try {
    await dbConnect();

    const { searchParams } = new URL(request.url);
    const headerId = searchParams.get("headerId");
    const productionUserId = searchParams.get("productionUserId");

    if (!headerId) {
      return Response.json(
        { success: false, message: "headerId query param is required" },
        { status: 400 }
      );
    }

    const query = { headerId };
    if (productionUserId) {
      query["productionUser.id"] = productionUserId;
    }

    const records = await HourlyProductionModel.find(query)
      .sort({ hour: 1 })
      .lean();

    return Response.json(
      { success: true, data: records },
      { status: 200 }
    );
  } catch (error) {
    console.error("GET /api/hourly-productions error:", error);
    return Response.json(
      { success: false, message: "Failed to fetch hourly production records" },
      { status: 500 }
    );
  }
}

// 🔸 POST /api/hourly-productions
// Body:
// {
//   headerId: string,
//   hour: number,
//   achievedQty: number,
//   productionUser: { id, Production_user_name, phone, bio }
// }
export async function POST(request) {
  try {
    await dbConnect();

    const body = await request.json();
    const errors = [];

    const headerId = body.headerId;
    const hour = toNumberOrZero(body.hour);
    const achievedQty = toNumberOrZero(body.achievedQty);
    const productionUser = body.productionUser;

    if (!headerId) {
      errors.push("headerId is required");
    }
    if (!hour || hour <= 0) {
      errors.push("hour must be a positive number");
    }
    if (!productionUser || !productionUser.id) {
      errors.push("productionUser.id is required");
    }
    if (!Number.isFinite(achievedQty) || achievedQty < 0) {
      errors.push("achievedQty must be a non-negative number");
    }

    if (errors.length > 0) {
      return Response.json({ success: false, errors }, { status: 400 });
    }

    // 🔹 Load header to get manpower, SMV, efficiency, etc.
    const header = await ProductionHeaderModel.findById(headerId).lean();

    if (!header) {
      return Response.json(
        { success: false, message: "Production header not found" },
        { status: 404 }
      );
    }

    const manpowerPresent = toNumberOrZero(header.manpowerPresent);
    const smv = toNumberOrZero(header.smv);

    // 🔹 Base hourly target at plan efficiency
    const baseTargetPerHour = computeBaseTargetPerHour(header);

    // 🔹 Load previous hours for:
    //  - previous variance (for dynamic target)
    //  - total achieved before this hour
    //  - sum of previous achieveEfficiency (for Total Efficiency)
    const previousRecords = await HourlyProductionModel.find({
      headerId,
      "productionUser.id": productionUser.id,
      hour: { $lt: hour },
    })
      .sort({ hour: 1 })
      .lean();

    let totalAchievedBefore = 0;
    let sumAchieveEffPrev = 0;

    for (const rec of previousRecords) {
      const prevAchieved = toNumberOrZero(rec.achievedQty);
      const prevAchieveEff = toNumberOrZero(rec.achieveEfficiency);

      totalAchievedBefore += prevAchieved;
      sumAchieveEffPrev += prevAchieveEff;
    }

    // 🔹 Previous hour's variance (achieved - dynamicTarget)
    const previousRecord =
      previousRecords.length > 0
        ? previousRecords[previousRecords.length - 1]
        : null;

    const previousVariance = previousRecord
      ? toNumberOrZero(previousRecord.varianceQty)
      : 0;

    // Shortfall from previous hour = abs(negative variance), else 0
    // Example: prev variance = -5  => shortfallPrevHour = 5
    //          prev variance = +10 => shortfallPrevHour = 0 (you are ahead)
    const shortfallPrevHour =
      previousVariance < 0 ? -previousVariance : 0;

    // 🔹 Dynamic target for this hour:
    //  base target + previous shortfall (from last hour only)
    //
    //  Example with base = 20 and achieved [15, 20, 15, 20, 10, 50]:
    //    H1: dyn = 20, var = -5
    //    H2: dyn = 20 + 5  = 25, var = -5
    //    H3: dyn = 20 + 5  = 25, var = -10
    //    H4: dyn = 20 + 10 = 30, var = -10
    //    H5: dyn = 20 + 10 = 30, var = -20
    //    H6: dyn = 20 + 20 = 40, var = +10
    const dynamicTarget = baseTargetPerHour + shortfallPrevHour;

    // 🔹 Variance for this hour (your requested sign convention)
    //  varianceQty = achieved - target
    //   < 0 => behind plan (short)
    //   > 0 => ahead of plan (excess)
    const varianceQty = achievedQty - dynamicTarget;

    // 🔹 Hourly efficiency (this hour)
    // Formula: Hourly Output * SMV / (Manpower * 60) * 100
    const hourlyEfficiency =
      manpowerPresent > 0 && smv > 0
        ? (achievedQty * smv * 100) / (manpowerPresent * 60)
        : 0;

    // 🔹 Overall efficiency up to this hour (Achieve Efficiency)
    // TotalAchievedUpToThisHour = previous achieved + this hour
    const totalAchievedUpToThisHour = totalAchievedBefore + achievedQty;

    // AchieveEff% = TotalAchieved * SMV / (Manpower * 60 * HourCompleted) * 100
    const achieveEfficiency =
      manpowerPresent > 0 && smv > 0 && hour > 0
        ? (totalAchievedUpToThisHour * smv * 100) /
          (manpowerPresent * 60 * hour)
        : 0;

    // 🔹 Total Efficiency:
    //  Total(Total achieve efficiency from 1st h to present h) / hour
    //
    //  => average of achieveEfficiency values from hour 1..current
    const totalEfficiency =
      hour > 0
        ? (sumAchieveEffPrev + achieveEfficiency) / hour
        : 0;

    // 🔹 Doc to save
    const doc = {
      headerId,
      hour,
      achievedQty,
      baseTargetPerHour,
      dynamicTarget,
      varianceQty,        // achieved - target (can be negative or positive)
      hourlyEfficiency,
      achieveEfficiency,  // overall till this hour
      totalEfficiency,    // average from 1st hour to this hour
      productionUser: {
        id: productionUser.id,
        Production_user_name: productionUser.Production_user_name,
        phone: productionUser.phone,
        bio: productionUser.bio,
      },
    };

    // 🔹 Upsert (one record per header + production user + hour)
    const existing = await HourlyProductionModel.findOne({
      headerId,
      "productionUser.id": doc.productionUser.id,
      hour,
    });

    let saved;
    if (existing) {
      Object.assign(existing, doc);
      saved = await existing.save();
    } else {
      saved = await HourlyProductionModel.create(doc);
    }

    return Response.json(
      {
        success: true,
        data: saved,
        message: "Hourly production record saved successfully",
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("POST /api/hourly-productions error:", error);
    return Response.json(
      {
        success: false,
        message:
          error.message || "Failed to save hourly production record",
      },
      { status: 500 }
    );
  }
}
