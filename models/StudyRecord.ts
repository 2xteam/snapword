import mongoose, { Schema, type Model, type InferSchemaType } from "mongoose";

const StudyRecordSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    wordId: { type: Schema.Types.ObjectId, ref: "Word", required: true, index: true },
    correctCount: { type: Number, default: 0, min: 0 },
    wrongCount: { type: Number, default: 0, min: 0 },
    lastStudiedAt: { type: Date, default: Date.now },
  },
  { versionKey: false },
);

StudyRecordSchema.index({ userId: 1, wordId: 1 }, { unique: true });

export type StudyRecordDocument = InferSchemaType<typeof StudyRecordSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const StudyRecord: Model<StudyRecordDocument> =
  mongoose.models.StudyRecord ??
  mongoose.model<StudyRecordDocument>(
    "StudyRecord",
    StudyRecordSchema,
    "study_records",
  );
