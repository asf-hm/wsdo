import { Schema, model, type InferSchemaType } from 'mongoose';

const userSchema = new Schema(
  {
    username: {
      type: String,
      required: true,
      trim: true,
      unique: true
    },
    password: {
      type: String,
      required: true,
      select: false
    },
    country: {
      type: String,
      required: true,
      trim: true,
      uppercase: true
    },
    libraries: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Library',
        required: true
      }
    ],
    role: {
      type: String,
      enum: ['admin', 'user'],
      default: 'user'
    }
  },
  { timestamps: true, versionKey: false }
);

export type User = InferSchemaType<typeof userSchema>;

export const UserModel = model('User', userSchema);
