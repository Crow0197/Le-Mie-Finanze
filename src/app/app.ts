import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { InstallBanner } from './core/pwa/install-banner';
import { TestModeBanner } from './core/test-mode/test-mode-banner';

@Component({
  imports: [RouterOutlet, InstallBanner, TestModeBanner],
  selector: 'app-root',
  styleUrl: './app.scss',
  templateUrl: './app.html',
})
export class App {}
