import type { CurrentUserService } from "./interface";

export function createLiveCurrentUserService(): CurrentUserService {
  return {
    getCurrentUserId() {
      return "dev-user-1";
    },
  };
}

export function createTestCurrentUserService(userId = "dev-user-1"): CurrentUserService {
  return {
    getCurrentUserId() {
      return userId;
    },
  };
}
