import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { LocalMatchScreenComponent } from './features/game/components/local-match-screen/local-match-screen.component';
import { PrivacyPolicyComponent } from './features/legal/components/privacy-policy/privacy-policy.component';

const routes: Routes = [
  { path: '', component: LocalMatchScreenComponent },
  { path: 'privacy-policy', redirectTo: 'politica-de-privacidade', pathMatch: 'full' },
  { path: 'politica-de-privacidade', component: PrivacyPolicyComponent },
  { path: '**', redirectTo: '' }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
