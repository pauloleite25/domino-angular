import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { DominoBoardComponent } from './features/game/components/domino-board/domino-board.component';
import { DominoTileVisualComponent } from './features/game/components/domino-tile-visual/domino-tile-visual.component';
import { LocalMatchScreenComponent } from './features/game/components/local-match-screen/local-match-screen.component';
import { MatchResultModalComponent } from './features/game/components/match-result-modal/match-result-modal.component';
import { MoveHistoryComponent } from './features/game/components/move-history/move-history.component';
import { PlayerHandComponent } from './features/game/components/player-hand/player-hand.component';
import { ScorePanelComponent } from './features/game/components/score-panel/score-panel.component';
import { TurnIndicatorComponent } from './features/game/components/turn-indicator/turn-indicator.component';

@NgModule({
  declarations: [
    AppComponent,
    LocalMatchScreenComponent,
    DominoBoardComponent,
    DominoTileVisualComponent,
    PlayerHandComponent,
    ScorePanelComponent,
    TurnIndicatorComponent,
    MoveHistoryComponent,
    MatchResultModalComponent
  ],
  imports: [
    BrowserModule,
    AppRoutingModule
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
