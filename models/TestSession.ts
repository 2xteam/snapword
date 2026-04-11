import mongoose, { Schema, type Model, type InferSchemaType } from "mongoose";

const TestSessionSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    vocabId: { type: Schema.Types.ObjectId, ref: "VocabularyDeck", required: true, index: true },
    folderId: { type: Schema.Types.ObjectId, ref: "Folder", required: true, index: true },
    score: { type: Number, required: true, min: 0 },
    total: { type: Number, required: true, min: 0 },
    correct: { type: Number, required: true, min: 0 },
    createdAt: { type: Date, default: Date.now },
  },
  { versionKey: false },
);

TestSessionSchema.index({ userId: 1, createdAt: -1 });

export type TestSessionDocument = InferSchemaType<typeof TestSessionSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const TestSession: Model<TestSessionDocument> =
  mongoose.models.TestSession ??
  mongoose.model<TestSessionDocument>(
    "TestSession",
    TestSessionSchema,
    "test_sessions",
  );
