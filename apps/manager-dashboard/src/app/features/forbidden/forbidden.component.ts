import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';

/**
 * ForbiddenComponent
 *
 * 403 Forbidden page displayed when user lacks required permissions.
 */
@Component({
  selector: 'khana-forbidden',
  standalone: true,
  imports: [RouterModule],
  template: `
    <div class="forbidden-container">
      <div class="forbidden-card">
        <h1 class="forbidden-title">403</h1>
        <h2 class="forbidden-subtitle">Access Forbidden</h2>
        <p class="forbidden-text">
          You don't have permission to access this page.
        </p>
        <a routerLink="/dashboard" class="btn-primary"> Go to Dashboard </a>
      </div>
    </div>
  `,
  styles: [
    `
      .forbidden-container {
        display: flex;
        align-items: center;
        justify-content: center;
        min-block-size: 100vh;
        padding-inline: var(--space-4);
      }

      .forbidden-card {
        text-align: center;
        max-inline-size: 500px;
      }

      .forbidden-title {
        font-size: 96px;
        font-weight: 700;
        color: var(--error, #c75d4a);
        margin: 0;
      }

      .forbidden-subtitle {
        font-size: 32px;
        font-weight: 600;
        color: var(--text-primary, #1a1f3c);
        margin-block: var(--space-4);
      }

      .forbidden-text {
        font-size: 16px;
        color: var(--text-secondary, #6b7280);
        margin-block-end: var(--space-6);
      }

      .btn-primary {
        display: inline-block;
        padding-inline: var(--space-6, 24px);
        padding-block: var(--space-3, 12px);
        background: var(--gold, #d4af37);
        color: var(--navy, #1a1f3c);
        text-decoration: none;
        border-radius: 8px;
        font-weight: 600;
        transition: all 0.2s ease;
      }

      .btn-primary:hover {
        background: #c49d2f;
        transform: translateY(-1px);
      }
    `,
  ],
})
export class ForbiddenComponent {}
