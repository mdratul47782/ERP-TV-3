// app/ProductionHourlyView/page.js
import { dbConnect } from "@/services/mongo";
import { ProductionHeaderModel } from "@/models/ProductionHeader-model";
import { HourlyProductionModel } from "@/models/HourlyProduction-model";
import { RegisterModel } from "@/models/register-model";
import { userModel } from "@/models/user-model";
import MediaLink from "@/models/MediaLink"; // note: default import (like in your other file)
import ProductionTvView from "@/app/ProductionComponents/ProductionTvView";
import InspectionTopforProduction from "@/app/ProductionComponents/InspectionTopforProduction";

export const revalidate = 0;

// 🔹 Generic deep serializer for any Mongoose docs
function safeJson(docs) {
  return JSON.parse(JSON.stringify(docs ?? []));
}

export default async function ProductionHourlyView() {
  await dbConnect();

  // 🔹 Load ALL data from all related models
  const [hourlyDocs, headerDocs, registerDocs, usersDocs, mediaDocs] =
    await Promise.all([
      HourlyProductionModel.find({}).lean(),
      ProductionHeaderModel.find({}).lean(),
      RegisterModel.find({}).lean(),
      userModel.find({}).lean(),
      MediaLink.find({}).lean(),
    ]);

  // 🔹 Safely serialize everything for client component
  const hourlyData = safeJson(hourlyDocs);
  const headerData = safeJson(headerDocs);
  const registerData = safeJson(registerDocs);
  const users = safeJson(usersDocs);
  const mediaLinks = safeJson(mediaDocs);

  console.log("✅ ProductionHourlyView: all model data fetched");

  return (
    <div className="min-h-screen bg-slate-900 text-slate-50">
      <InspectionTopforProduction
        registerData={registerData}
        className=" !bg-black !text-white"
      />
      <ProductionTvView
        hourlyData={hourlyData}
        headerData={headerData}
        registerData={registerData}
        users={users}
        mediaLinks={mediaLinks}
      />
    </div>
  );
}
