import { Schema, model, type InferSchemaType } from 'mongoose';

const bookSchema = new Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true
    },
    author: {
      type: String,
      required: true,
      trim: true
    },
    authorCountry: {
      type: String,
      required: true,
      trim: true,
      uppercase: true
    },
    publishedDate: {
      type: Date,
      required: true
    },
    pages: {
      type: Number,
      required: true,
      min: 1
    },
    library: {
      type: Schema.Types.ObjectId,
      ref: 'Library',
      required: true
    }
  },
  { timestamps: true, versionKey: false }
);

bookSchema.index({ library: 1 });

export type Book = InferSchemaType<typeof bookSchema>;

export const BookModel = model('Book', bookSchema);
