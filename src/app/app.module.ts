import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { FormsModule } from '@angular/forms';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { DominoBoardComponent } from './features/game/components/domino-board/domino-board.component';
import { DesktopMatchSidebarComponent } from './features/game/components/desktop-match-sidebar/desktop-match-sidebar.component';
import { DesktopReactionBarComponent } from './features/game/components/desktop-reaction-bar/desktop-reaction-bar.component';
import { DominoTileVisualComponent } from './features/game/components/domino-tile-visual/domino-tile-visual.component';
import { LocalMatchScreenComponent } from './features/game/components/local-match-screen/local-match-screen.component';
import { MatchResultModalComponent } from './features/game/components/match-result-modal/match-result-modal.component';
import { MobileReactionMenuComponent } from './features/game/components/mobile-reaction-menu/mobile-reaction-menu.component';
import { MoveHistoryComponent } from './features/game/components/move-history/move-history.component';
import { PlayerHandComponent } from './features/game/components/player-hand/player-hand.component';
import { ScorePanelComponent } from './features/game/components/score-panel/score-panel.component';
import { TurnIndicatorComponent } from './features/game/components/turn-indicator/turn-indicator.component';
import { PrivacyPolicyComponent } from './features/legal/components/privacy-policy/privacy-policy.component';

@NgModule({
  declarations: [
    AppComponent,
    LocalMatchScreenComponent,
    DominoBoardComponent,
    DesktopMatchSidebarComponent,
    DesktopReactionBarComponent,
    DominoTileVisualComponent,
    MobileReactionMenuComponent,
    PlayerHandComponent,
    ScorePanelComponent,
    TurnIndicatorComponent,
    MoveHistoryComponent,
    MatchResultModalComponent,
    PrivacyPolicyComponent
  ],
  imports: [
    BrowserModule,
    FormsModule,
    AppRoutingModule
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
