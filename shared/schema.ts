// User types for MongoDB schema
export interface User {
  _id?: string;
  openId: string;
  name?: string | null;
  email?: string | null;
  loginMethod?: string | null;
  role: 'user' | 'admin';
  createdAt: Date;
  updatedAt: Date;
  lastSignedIn: Date;
}

export type InsertUser = Omit<User, '_id' | 'createdAt' | 'updatedAt'> & {
  createdAt?: Date;
  updatedAt?: Date;
};
