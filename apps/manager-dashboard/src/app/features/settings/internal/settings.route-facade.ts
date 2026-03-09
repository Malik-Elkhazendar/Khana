import { Directive, OnInit } from '@angular/core';
import { SettingsRouteGoalsBase } from './settings.route-goals';

/**
 * Settings route facade keeps the standalone component focused on composition.
 * The inherited API matches the existing template and spec surface.
 */
@Directive()
export class SettingsRouteFacade
  extends SettingsRouteGoalsBase
  implements OnInit
{
  ngOnInit(): void {
    this.loadTenantContext();
    this.loadTenantSettings();
    this.loadGoalSettings();
  }
}
