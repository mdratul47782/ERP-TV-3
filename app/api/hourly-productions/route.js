// app/api/hourly-productions/route.js
import { dbConnect } from "@/services/mongo";
import { ProductionHeaderModel } from "@/models/ProductionHeader-model";
import { HourlyProductionModel } from "@/models/HourlyProduction-model";

// 🔹 helper for safe number parsing
function toNumberOrZero(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

// 🔹 Compute base hourly target (GARMENT RULE)
// Target/hr = Manpower × 60 × Plan Eff% ÷ SMV
// Fallback: DayTarget / WorkingHour when capacity can't be computed
function computeBaseTargetPerHour(header) {
  const workingHour = toNumberOrZero(header.workingHour);
  const todayTarget = toNumberOrZero(header.todayTarget);
  const manpowerPresent = toNumberOrZero(header.manpowerPresent);
  const smv = toNumberOrZero(header.smv);
  const planEfficiencyPercent = toNumberOrZero(header.planEfficiency);
  const planEffDecimal = planEfficiencyPercent / 100;

  const targetFromCapacity =
    manpowerPresent > 0 && smv > 0
      ? (manpowerPresent * 60 * planEffDecimal) / smv
      : 0;

  const targetFromTodayTarget =
    workingHour > 0 ? todayTarget / workingHour : 0;

  // Prefer capacity-based target; fall back to plan/day only if needed
  return targetFromCapacity || targetFromTodayTarget || 0;
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

    // 🔹 Base hourly target at plan efficiency (GARMENT RULE)
    const baseTargetPerHour = computeBaseTargetPerHour(header);

    // 🔹 Load previous hours for:
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
    // Example:
    //   H1: base = 49, achieved = 40
    //       variance = 40 - 49 = -9 => shortfallPrevHour = 9
    //   H2: dynamicTarget = 49 + 9 = 58
    const shortfallPrevHour =
      previousVariance < 0 ? -previousVariance : 0;

    // 🔹 Dynamic target for this hour (Base + previous shortfall)
    const dynamicTarget = baseTargetPerHour + shortfallPrevHour;

    // 🔹 Variance for this hour (your convention)
    // varianceQty = achieved - dynamicTarget
    //  < 0 => short (behind)
    //  > 0 => ahead
    const varianceQty = achievedQty - dynamicTarget;

    // 🔹 Hourly efficiency (this hour)
    //   Hourly Eff % = Hourly Output * SMV / (Manpower * 60) * 100
    const hourlyEfficiency =
      manpowerPresent > 0 && smv > 0
        ? (achievedQty * smv * 100) / (manpowerPresent * 60)
        : 0;

    // 🔹 Overall efficiency up to this hour (Achieve Efficiency)
    // TotalAchievedUpToThisHour = previous achieved + this hour
    // AchieveEff% = TotalAchieved * SMV / (Manpower * 60 * HourCompleted) * 100
    const totalAchievedUpToThisHour = totalAchievedBefore + achievedQty;

    const achieveEfficiency =
      manpowerPresent > 0 && smv > 0 && hour > 0
        ? (totalAchievedUpToThisHour * smv * 100) /
          (manpowerPresent * 60 * hour)
        : 0;

    // 🔹 Total Efficiency:
    //  average of achieveEfficiency from hour 1..current
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
