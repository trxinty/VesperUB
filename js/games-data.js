(function () {
  'use strict';
  window.Vesper = window.Vesper || {};

  /**
   * Vesper Games Registry (Phase 1: Intentionally Empty)
   * ----------------------------------------------------
   * When you're ready to add games in Phase 2, append objects in this format:
   * {
   *   id: 'my-game',
   *   title: 'My Game',
   *   category: 'Arcade',
   *   thumbnail: './assets/games/my-game.png',
   *   url: './games/my-game/index.html'
   * }
   */
  window.Vesper.GamesData = [];

  window.Vesper.GameCategories = [
    'All',
    'Favorites',
    'Recent',
    'Action',
    'Arcade',
    'Puzzle',
    'Platformer',
    'Racing',
    'Strategy',
    'Sports',
    'Multiplayer',
    'Retro'
  ];
})();
