import mongoose, { Schema, type Model, type InferSchemaType } from "mongoose";

const WordSchema = new Schema(
  {
    vocabId: { type: Schema.Types.ObjectId, ref: "VocabularyDeck", required: true, index: true },
    word: { type: String, required: true, trim: true },
    meaning: { type: String, default: "" },
    example: { type: String, default: "" },
    synonyms: { type: [String], default: [] },
    antonyms: { type: [String], default: [] },
    createdAt: { type: Date, default: Date.now },
  },
  { versionKey: false },
);

WordSchema.index({ vocabId: 1, word: 1 });

export type WordDocument = InferSchemaType<typeof WordSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const Word: Model<WordDocument> =
  mongoose.models.Word ?? mongoose.model<WordDocument>("Word", WordSchema, "words");
