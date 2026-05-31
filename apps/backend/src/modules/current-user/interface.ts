export interface CurrentUserService {
  /**
   * Returns the User id that owns Budget Data for the current request.
   */
  getCurrentUserId(): string;
}
