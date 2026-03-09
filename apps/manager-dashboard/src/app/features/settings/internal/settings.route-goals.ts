import { SettingsRouteNotificationsBase } from './settings.route-notifications';

/**
 * Goal target editing is kept separate from tenant settings because it has its
 * own owner-only validation and persistence flow.
 */
export abstract class SettingsRouteGoalsBase extends SettingsRouteNotificationsBase {
  loadGoalSettings(): void {
    this.goalsLoading.set(true);
    this.goalsError.set(null);

    this.api.getGoalSettings().subscribe({
      next: (settings) => {
        this.monthlyRevenueTarget.set(
          settings.monthlyRevenueTarget === null
            ? ''
            : `${settings.monthlyRevenueTarget}`
        );
        this.monthlyOccupancyTarget.set(
          settings.monthlyOccupancyTarget === null
            ? ''
            : `${settings.monthlyOccupancyTarget}`
        );
        this.goalShouldShowNudge.set(settings.shouldShowNudge);
        this.goalsLoading.set(false);
      },
      error: () => {
        this.goalsError.set('DASHBOARD.PAGES.SETTINGS.GOALS.LOAD_ERROR');
        this.goalsLoading.set(false);
      },
    });
  }

  saveGoals(): void {
    if (!this.isOwner()) {
      return;
    }

    const revenueRaw = this.monthlyRevenueTarget().trim();
    const occupancyRaw = this.monthlyOccupancyTarget().trim();
    const revenueTarget = revenueRaw === '' ? null : Number(revenueRaw);
    const occupancyTarget = occupancyRaw === '' ? null : Number(occupancyRaw);

    if (
      (revenueTarget !== null &&
        (!Number.isFinite(revenueTarget) || revenueTarget < 0.01)) ||
      (occupancyTarget !== null &&
        (!Number.isFinite(occupancyTarget) ||
          occupancyTarget < 0.01 ||
          occupancyTarget > 100))
    ) {
      this.goalsError.set('DASHBOARD.PAGES.SETTINGS.GOALS.VALIDATION_ERROR');
      this.goalsMessage.set(null);
      return;
    }

    this.goalsSaving.set(true);
    this.goalsError.set(null);
    this.goalsMessage.set(null);

    this.api
      .updateGoalSettings({
        monthlyRevenueTarget: revenueTarget,
        monthlyOccupancyTarget: occupancyTarget,
      })
      .subscribe({
        next: (settings) => {
          this.monthlyRevenueTarget.set(
            settings.monthlyRevenueTarget === null
              ? ''
              : `${settings.monthlyRevenueTarget}`
          );
          this.monthlyOccupancyTarget.set(
            settings.monthlyOccupancyTarget === null
              ? ''
              : `${settings.monthlyOccupancyTarget}`
          );
          this.goalShouldShowNudge.set(settings.shouldShowNudge);
          this.goalsMessage.set('DASHBOARD.PAGES.SETTINGS.GOALS.SAVE_SUCCESS');
          this.goalsSaving.set(false);
        },
        error: () => {
          this.goalsError.set('DASHBOARD.PAGES.SETTINGS.GOALS.SAVE_ERROR');
          this.goalsSaving.set(false);
        },
      });
  }
}
