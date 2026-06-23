import { App, PluginSettingTab, Setting } from "obsidian";
import type WikiCommandCentrePlugin from "./main";

export interface CommandCentreSettings {
  // Absolute path to the wiki dir (the vault root that holds wiki-graph.sh). Empty = vault root.
  scriptsDir: string;
  graphifyBin: string;
  // Optional ISO date (YYYY-MM-DD) to treat as "today" — handy for demos/tests. Empty = real today.
  todayOverride: string;
  // Re-render the active hub when frontmatter changes.
  liveRefresh: boolean;
  dashboardsConfig: string; // vault-relative path
}

export const DEFAULT_SETTINGS: CommandCentreSettings = {
  scriptsDir: "",
  graphifyBin: "graphify",
  todayOverride: "",
  liveRefresh: true,
  dashboardsConfig: ".command-centre/dashboards.yaml",
};

export class CommandCentreSettingTab extends PluginSettingTab {
  plugin: WikiCommandCentrePlugin;

  constructor(app: App, plugin: WikiCommandCentrePlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "Wiki Command Centre" });

    new Setting(containerEl)
      .setName("Scripts directory")
      .setDesc("Absolute path to the wiki dir containing wiki-graph.sh / wiki-federate.sh. Leave blank to use the vault root.")
      .addText((t) =>
        t
          .setPlaceholder("/Users/me/Desktop/knowledge/wiki")
          .setValue(this.plugin.settings.scriptsDir)
          .onChange(async (v) => {
            this.plugin.settings.scriptsDir = v.trim();
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("graphify binary")
      .setDesc("Path or name of the graphify executable used for queries.")
      .addText((t) =>
        t
          .setValue(this.plugin.settings.graphifyBin)
          .onChange(async (v) => {
            this.plugin.settings.graphifyBin = v.trim() || "graphify";
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Dashboards config")
      .setDesc("Vault-relative path to dashboards.yaml.")
      .addText((t) =>
        t
          .setValue(this.plugin.settings.dashboardsConfig)
          .onChange(async (v) => {
            this.plugin.settings.dashboardsConfig = v.trim() || DEFAULT_SETTINGS.dashboardsConfig;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("\"Today\" override")
      .setDesc("Optional YYYY-MM-DD used as today for overdue/this-week calculations. Blank = real date.")
      .addText((t) =>
        t
          .setPlaceholder("2026-06-23")
          .setValue(this.plugin.settings.todayOverride)
          .onChange(async (v) => {
            this.plugin.settings.todayOverride = v.trim();
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Live refresh")
      .setDesc("Re-render dashboards when note frontmatter changes.")
      .addToggle((t) =>
        t.setValue(this.plugin.settings.liveRefresh).onChange(async (v) => {
          this.plugin.settings.liveRefresh = v;
          await this.plugin.saveSettings();
        })
      );
  }
}
