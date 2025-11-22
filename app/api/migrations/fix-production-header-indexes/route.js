// app/api/migrations/fix-production-header-indexes/route.js
// 🔹 Utility endpoint to fix MongoDB index mismatch
import { dbConnect } from "@/services/mongo";
import { fixProductionHeaderIndexes } from "@/models/ProductionHeader-model";

export async function POST(request) {
  try {
    await dbConnect();
    
    const result = await fixProductionHeaderIndexes();
    
    if (result.success) {
      return Response.json(
        {
          success: true,
          message: result.message || "Indexes fixed successfully",
        },
        { status: 200 }
      );
    } else {
      return Response.json(
        {
          success: false,
          message: result.error || "Failed to fix indexes",
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Migration endpoint error:", error);
    return Response.json(
      {
        success: false,
        message: error.message || "Failed to fix indexes",
      },
      { status: 500 }
    );
  }
}

