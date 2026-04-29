import { Schema, model, type InferSchemaType } from 'mongoose';

const librarySchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      unique: true
    },
    location: {
      type: String,
      required: true,
      trim: true
    }
  },
  { timestamps: true, versionKey: false }
);

export type Library = InferSchemaType<typeof librarySchema>;

export const LibraryModel = model('Library', librarySchema);
