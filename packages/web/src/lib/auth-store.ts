export type StoredUser = {
  id: string;
  email: string;
  hashedPassword: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  userType?: string;
};

export const users: StoredUser[] = [];
