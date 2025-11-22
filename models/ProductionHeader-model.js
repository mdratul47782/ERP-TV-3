// models/ProductionHeader-model.js
import { Schema, model, models } from "mongoose";

// 🔹 We'll store snapshots of both users (no password)
const EmbeddedUserSchema = new Schema(
  {
    id: { type: String, required: true },
    user_name: { type: String }, // for quality user
    Production_user_name: { type: String }, // for production user
    phone: { type: String },
    bio: { type: String },
  },
  { _id: false }
);

const ProductionHeaderSchema = new Schema(
  {
    // 🔹 One record per production user per day
    productionDate: {
      type: String, // "YYYY-MM-DD"
      required: true,
    },

    // 🔹 All fields optional – user may leave blank
    operatorTo: { type: Number },
    manpowerPresent: { type: Number },
    manpowerAbsent: { type: Number },
    workingHour: { type: Number },
    planQuantity: { type: Number },
    planEfficiency: { type: Number },
    smv: { type: Number }, // ✅ NEW
    todayTarget: { type: Number },
    achieve: { type: Number },

    // 🔹 Production user snapshot
    productionUser: {
      type: EmbeddedUserSchema,
      required: true,
    },

    // 🔹 Quality user snapshot (optional)
    qualityUser: {
      type: EmbeddedUserSchema,
      required: false,
    },
  },
  {
    timestamps: true, // createdAt + updatedAt
  }
);

// 🔹 Unique per production user + date
ProductionHeaderSchema.index(
  { "productionUser.id": 1, productionDate: 1 },
  { unique: true }
);

export const ProductionHeaderModel =
  models.ProductionHeader || model("ProductionHeader", ProductionHeaderSchema);

// 🔹 Helper function to fix index issues (drop old headerDate index)
export async function fixProductionHeaderIndexes() {
  try {
    const collection = ProductionHeaderModel.collection;

    // Get all indexes
    let indexes = await collection.indexes();

    // Find and drop old headerDate index
    const oldIndexName = "productionUser.id_1_headerDate_1";
    const hasOldIndex = indexes.some((idx) => idx.name === oldIndexName);

    if (hasOldIndex) {
      console.log(`🔧 Dropping old index: ${oldIndexName}`);
      await collection.dropIndex(oldIndexName);
      console.log(`✅ Successfully dropped old index: ${oldIndexName}`);
      // Re-fetch indexes after dropping
      indexes = await collection.indexes();
    }

    // Ensure correct index exists
    const correctIndexName = "productionUser.id_1_productionDate_1";
    const hasCorrectIndex = indexes.some(
      (idx) => idx.name === correctIndexName
    );

    if (!hasCorrectIndex) {
      console.log(`🔧 Creating correct index: ${correctIndexName}`);
      await collection.createIndex(
        { "productionUser.id": 1, productionDate: 1 },
        { unique: true, name: correctIndexName }
      );
      console.log(`✅ Successfully created correct index: ${correctIndexName}`);
    } else {
      console.log(`✅ Correct index already exists: ${correctIndexName}`);
    }

    return { success: true, message: "Indexes fixed successfully" };
  } catch (error) {
    console.error("❌ Error fixing indexes:", error);
    return { success: false, error: error.message };
  }
}
