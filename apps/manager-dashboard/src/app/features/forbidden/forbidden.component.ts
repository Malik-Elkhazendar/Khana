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
  templateUrl: './forbidden.component.html',
  styleUrl: './forbidden.component.scss',
})
export class ForbiddenComponent {}
