import { invoke } from "@tauri-apps/api/core";
import type { GameScanResult, LaunchGameRequest } from "./types";

export const listInstalledGames = (force = false) =>
  invoke<GameScanResult>("list_installed_games", { force });

export const launchGame = (request: LaunchGameRequest) =>
  invoke<void>("launch_game", { request });

export const openGameStorePage = (request: LaunchGameRequest) =>
  invoke<void>("open_game_store_page", { request });
