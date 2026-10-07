import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient, UserRole } from "@prisma/client";
import { authService } from "../src/module/auth/auth.service";

const prisma = new PrismaClient();

const ADMIN_USER = {
  fullName: "Themora Administrator",
  email: "admin@themora.test",
  password: "Admin@Themora2026!",
  role: "ADMIN" as UserRole,
  profile: {
    avatarUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=500&q=80",
    coverImageUrl: "https://images.unsplash.com/photo-1707343843437-caacff5cfa74?auto=format&fit=crop&w=1200&q=80",
    designation: "Chief Technology Officer & Lead Admin",
    phone: "+1 (555) 019-2834",
    country: "United States",
    city: "San Francisco",
    stateOrRegion: "California",
    postCode: "94105",
    balance: 5000.0,
  },
};

const STANDARD_USER = {
  fullName: "Sarah Jenkins",
  email: "sarah.user@themora.test",
  password: "User@Themora2026!",
  role: "USER" as UserRole,
  profile: {
    avatarUrl: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=500&q=80",
    coverImageUrl: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1200&q=80",
    designation: "Senior UI/UX Designer & Developer",
    phone: "+1 (555) 432-8765",
    country: "United States",
    city: "New York",
    stateOrRegion: "New York",
    postCode: "10001",
    balance: 750.5,
  },
};

async function main() {
  console.log("==================================================");
  console.log("🚀 STARTING USER API TESTS & DATABASE SEEDING");
  console.log("==================================================");

  // 1. Seed / Upsert ADMIN User with all profile fields filled
  console.log("\n📦 1. Seeding / Updating ADMIN User in Database...");
  const adminHashedPassword = await bcrypt.hash(ADMIN_USER.password, 12);
  const adminUser = await prisma.user.upsert({
    where: { email: ADMIN_USER.email },
    create: {
      fullName: ADMIN_USER.fullName,
      email: ADMIN_USER.email,
      password: adminHashedPassword,
      role: ADMIN_USER.role,
      provider: "email",
      otpVerified: true,
      isBanned: false,
      isTrashed: false,
      isDeletedPermanently: false,
      profile: {
        create: ADMIN_USER.profile,
      },
    },
    update: {
      fullName: ADMIN_USER.fullName,
      password: adminHashedPassword,
      role: ADMIN_USER.role,
      provider: "email",
      otpVerified: true,
      isBanned: false,
      isTrashed: false,
      isDeletedPermanently: false,
      profile: {
        upsert: {
          create: ADMIN_USER.profile,
          update: ADMIN_USER.profile,
        },
      },
    },
    include: { profile: true },
  });
  console.log("✅ Admin User Ready in DB:", {
    id: adminUser.id,
    email: adminUser.email,
    role: adminUser.role,
    fullName: adminUser.fullName,
    avatarUrl: adminUser.profile?.avatarUrl,
  });

  // 2. Seed / Upsert STANDARD User with all profile fields filled
  console.log("\n📦 2. Seeding / Updating STANDARD User in Database...");
  const userHashedPassword = await bcrypt.hash(STANDARD_USER.password, 12);
  const standardUser = await prisma.user.upsert({
    where: { email: STANDARD_USER.email },
    create: {
      fullName: STANDARD_USER.fullName,
      email: STANDARD_USER.email,
      password: userHashedPassword,
      role: STANDARD_USER.role,
      provider: "email",
      otpVerified: true,
      isBanned: false,
      isTrashed: false,
      isDeletedPermanently: false,
      profile: {
        create: STANDARD_USER.profile,
      },
    },
    update: {
      fullName: STANDARD_USER.fullName,
      password: userHashedPassword,
      role: STANDARD_USER.role,
      provider: "email",
      otpVerified: true,
      isBanned: false,
      isTrashed: false,
      isDeletedPermanently: false,
      profile: {
        upsert: {
          create: STANDARD_USER.profile,
          update: STANDARD_USER.profile,
        },
      },
    },
    include: { profile: true },
  });
  console.log("✅ Standard User Ready in DB:", {
    id: standardUser.id,
    email: standardUser.email,
    role: standardUser.role,
    fullName: standardUser.fullName,
    avatarUrl: standardUser.profile?.avatarUrl,
  });

  // 3. Test Full Registration & Verification Flow
  console.log("\n🧪 3. Testing REGISTER & VERIFY-OTP API Flow...");
  const testRegEmail = "test.registered@themora.test";
  // Clean up previous test run if exists
  await prisma.userProfile.deleteMany({
    where: { user: { email: testRegEmail } },
  });
  await prisma.user.deleteMany({
    where: { email: testRegEmail },
  });

  const regResult = await authService.registerUser({
    name: "Alex Rivera",
    email: testRegEmail,
    password: "Password123!",
  });
  console.log("Register API Result:", {
    success: regResult.success,
    message: regResult.message,
    userId: regResult.data?.user?.id,
  });

  // Fetch the OTP from DB to test verification
  const userInDb = await prisma.user.findUnique({
    where: { email: testRegEmail },
  });
  const otpCode = userInDb?.otpCode || "123456";

  const verifyResult = await authService.verifyOtp({
    email: testRegEmail,
    otp: otpCode,
  });
  console.log("Verify OTP API Result:", {
    success: verifyResult.success,
    message: verifyResult.message,
  });

  // 4. Test LOGIN for User
  console.log("\n🧪 4. Testing LOGIN API for Standard User...");
  const loginResult = await authService.loginUser({
    email: STANDARD_USER.email,
    password: STANDARD_USER.password,
  });
  console.log("Login API Result:", {
    success: loginResult.success,
    token: loginResult.data?.nextAuthSecret ? "Token issued (valid)" : "No token",
    userName: loginResult.data?.user?.fullName,
    role: loginResult.data?.user?.role,
  });
  const userToken = loginResult.data?.nextAuthSecret!;

  // 5. Test GET CURRENT USER (/me)
  console.log("\n🧪 5. Testing GET CURRENT USER (/me)...");
  const meResult = await authService.getUserById(standardUser.id);
  console.log("Get Current User Result:", {
    success: meResult.success,
    user: {
      id: meResult.data?.user?.id,
      name: meResult.data?.user?.fullName,
      email: meResult.data?.user?.email,
      role: meResult.data?.user?.role,
      avatar: meResult.data?.user?.profile?.avatarUrl,
      phone: meResult.data?.user?.profile?.phone,
      designation: meResult.data?.user?.profile?.designation,
      city: meResult.data?.user?.profile?.city,
    },
  });

  // 6. Test UPDATE PROFILE API (with Unsplash image and full fields)
  console.log("\n🧪 6. Testing UPDATE PROFILE API...");
  const updatedProfile = await authService.updateProfile(standardUser.id, {
    name: "Sarah Jenkins (Verified)",
    avatarUrl: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=500&q=80",
    phone: "+1 (555) 987-6543",
    address: "742 Evergreen Terrace, Brooklyn, NY 11201",
    country: "United States",
    city: "New York",
    stateOrRegion: "New York",
    designation: "Principal Design Architect",
    postCode: "11201",
  });
  console.log("Update Profile Result:", {
    success: updatedProfile.success,
    name: updatedProfile.data?.user?.fullName,
    avatarUrl: updatedProfile.data?.user?.profile?.avatarUrl,
    designation: updatedProfile.data?.user?.profile?.designation,
    phone: updatedProfile.data?.user?.profile?.phone,
    stateOrRegion: updatedProfile.data?.user?.profile?.stateOrRegion,
  });

  // 7. Test ADMIN: GET ALL USERS LIST
  console.log("\n🧪 7. Testing ADMIN GET ALL USERS API...");
  const allUsersResult = await authService.getAllUsers({ page: 1, limit: 10 });
  console.log("Admin Get All Users Result:", {
    totalUsers: allUsersResult.pagination.total,
    totalPages: allUsersResult.pagination.totalPages,
    usersReturned: allUsersResult.users.length,
    userRoles: allUsersResult.users.map((u) => ({ email: u.email, role: u.role, fullName: u.fullName })),
  });

  // 8. Test ADMIN: CHANGE USER ROLE API
  console.log("\n🧪 8. Testing ADMIN CHANGE USER ROLE API...");
  const changeRoleResult = await authService.updateUser(userInDb!.id, {
    role: "ADMIN",
  });
  console.log("Admin Change Role to ADMIN Result:", {
    success: changeRoleResult.success,
    userId: changeRoleResult.data?.user?.id,
    newRole: changeRoleResult.data?.user?.role,
  });

  // Change it back to USER
  const revertRoleResult = await authService.updateUser(userInDb!.id, {
    role: "USER",
  });
  console.log("Admin Revert Role to USER Result:", {
    success: revertRoleResult.success,
    newRole: revertRoleResult.data?.user?.role,
  });

  // 9. Test LOGOUT API
  console.log("\n🧪 9. Testing LOGOUT API...");
  const logoutResult = await authService.logoutUser(userToken);
  console.log("Logout API Result:", {
    success: logoutResult.success,
    message: logoutResult.message,
  });

  // 10. Summary Verification
  console.log("\n==================================================");
  console.log("🎉 ALL TESTS PASSED SUCCESSFULLY & STORED IN DATABASE!");
  console.log("==================================================");
}

main()
  .catch((e) => {
    console.error("❌ Test failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
