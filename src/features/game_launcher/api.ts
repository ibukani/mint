import { invoke } from "@tauri-apps/api/core";
import type {
  GameScanResult,
  GameSourceSummary,
  LaunchGameRequest,
} from "./types";

export const listInstalledGames = (force = false) =>
  invoke<GameScanResult>("list_installed_games", { force });

export const getGameSourceStatus = (force = false) =>
  invoke<GameSourceSummary>("get_game_source_status", { force });

export const launchGame = (request: LaunchGameRequest) =>
  invoke<void>("launch_game", { request });

export const openGameStorePage = (request: LaunchGameRequest) =>
  invoke<void>("open_game_store_page", { request });
