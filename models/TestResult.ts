import mongoose, { Schema, type Model, type InferSchemaType } from "mongoose";

export const TEST_RESULT_TYPES = [
  "meaning",
  "example",
  "synonym",
  "antonym",
] as const;

export type TestResultType = (typeof TEST_RESULT_TYPES)[number];

const TestResultSchema = new Schema(
  {
    sessionId: { type: Schema.Types.ObjectId, ref: "TestSession", required: true, index: true },
    wordId: { type: Schema.Types.ObjectId, ref: "Word", required: true, index: true },
    isCorrect: { type: Boolean, required: true },
    type: { type: String, enum: TEST_RESULT_TYPES, required: true },
  },
  { versionKey: false },
);

TestResultSchema.index({ sessionId: 1, wordId: 1, type: 1 });

export type TestResultDocument = InferSchemaType<typeof TestResultSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const TestResult: Model<TestResultDocument> =
  mongoose.models.TestResult ??
  mongoose.model<TestResultDocument>(
    "TestResult",
    TestResultSchema,
    "test_results",
  );
