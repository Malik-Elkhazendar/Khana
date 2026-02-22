import { TestBed } from '@angular/core/testing';
import { RouterModule } from '@angular/router';
import { App } from './app';
import { AuthService } from './shared/services/auth.service';
import { LanguageService } from './shared/services/language.service';

describe('App', () => {
  const authServiceMock = {
    restoreSession: jest.fn(),
  };

  const languageServiceMock = {
    init: jest.fn(),
    getCurrentLanguage: jest.fn(() => 'en'),
    setLanguage: jest.fn(),
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App, RouterModule.forRoot([])],
      providers: [
        { provide: AuthService, useValue: authServiceMock },
        { provide: LanguageService, useValue: languageServiceMock },
      ],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should have the correct title', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app.title).toEqual('Khana Manager Dashboard');
  });

  it('should render router outlet', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('router-outlet')).toBeTruthy();
  });
});
