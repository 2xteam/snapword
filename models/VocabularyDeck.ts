import mongoose, { Schema, type Model, type InferSchemaType } from "mongoose";

const VocabularyDeckSchema = new Schema(
  {
    folderId: { type: Schema.Types.ObjectId, ref: "Folder", required: true, index: true },
    phone: { type: String, required: true, index: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    createdAt: { type: Date, default: Date.now },
    deletedAt: { type: Date, default: null, index: true },
  },
  { versionKey: false },
);

VocabularyDeckSchema.index({ phone: 1, folderId: 1, name: 1 });

export type VocabularyDeckDocument = InferSchemaType<typeof VocabularyDeckSchema> & {
  _id: mongoose.Types.ObjectId;
};

/** 컬렉션명: `vocabularies` */
export const VocabularyDeck: Model<VocabularyDeckDocument> =
  mongoose.models.VocabularyDeck ??
  mongoose.model<VocabularyDeckDocument>(
    "VocabularyDeck",
    VocabularyDeckSchema,
    "vocabularies",
  );
