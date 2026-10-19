import { UserModel, UserDocument } from '../models/User';
import { IUser } from '../types';

export class UserRepository {
  async findByEmail(email: string): Promise<UserDocument | null> {
    return UserModel.findOne({ email: email.toLowerCase().trim() });
  }

  async findByEmployeeId(employeeId: string): Promise<UserDocument | null> {
    return UserModel.findOne({ employeeId: employeeId.toUpperCase().trim() });
  }

  async findById(id: string): Promise<UserDocument | null> {
    return UserModel.findById(id);
  }

  async create(userData: Partial<IUser>): Promise<UserDocument> {
    return UserModel.create(userData);
  }

  async findAll(): Promise<UserDocument[]> {
    return UserModel.find({ deletedAt: null }).sort({ createdAt: -1 });
  }

  async update(id: string, updates: Partial<IUser>): Promise<UserDocument | null> {
    return UserModel.findByIdAndUpdate(id, updates, { new: true });
  }

  async softDelete(id: string): Promise<UserDocument | null> {
    return UserModel.findByIdAndUpdate(
      id,
      { isActive: false, deletedAt: new Date() },
      { new: true }
    );
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.softDelete(id);
    return !!result;
  }

  async countDocuments(filter: Record<string, unknown> = {}): Promise<number> {
    return UserModel.countDocuments({ deletedAt: null, ...filter });
  }

  async findWithPagination(
    filter: Record<string, unknown> = {},
    page = 1,
    limit = 15
  ): Promise<{ users: UserDocument[]; total: number }> {
    const safePage = Math.max(1, page);
    const safeLimit = Math.min(50, Math.max(1, limit));
    const skip = (safePage - 1) * safeLimit;

    const baseFilter = { deletedAt: null, ...filter };

    const [users, total] = await Promise.all([
      UserModel.find(baseFilter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(safeLimit),
      UserModel.countDocuments(baseFilter),
    ]);

    return { users, total };
  }
}

export const userRepository = new UserRepository();
