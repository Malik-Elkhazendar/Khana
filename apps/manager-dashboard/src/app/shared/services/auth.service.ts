import { Injectable } from '@angular/core';
import { AuthServiceFacade } from './internal/auth/auth.service.interactive';

/**
 * Public auth service facade for the dashboard app.
 * Internal layers own tenant resolution, session recovery, and interactive auth workflows.
 */
@Injectable({ providedIn: 'root' })
export class AuthService extends AuthServiceFacade {}
