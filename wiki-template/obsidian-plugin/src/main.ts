import { Plugin, FileSystemAdapter, Notice } from "obsidian";
import { CommandCentreSettings, DEFAULT_SETTINGS, CommandCentreSettingTab } from "./settings";
import { Runner } from "./runner";
import { CommandCentreView, VIEW_TYPE_CC } from "./view";

export default class WikiCommandCentrePlugin extends Plugin {
  settings!: CommandCentreSettings;
  runner!: Runner;

  async onload(): Promise<void> {
    await this.loadSettings();
    this.rebuildRunner();

    this.registerView(VIEW_TYPE_CC, (leaf) => new CommandCentreView(leaf, this));

    this.addRibbonIcon("gauge", "Wiki Command Centre", () => this.activateView());

    this.addCommand({
      id: "open",
      name: "Open Command Centre",
      callback: () => this.activateView(),
    });
    this.addCommand({
      id: "rebuild-graph",
      name: "Rebuild knowledge graph",
      callback: async () => {
        new Notice("Building graph…");
        const r = await this.runner.graphBuild();
        new Notice(r.code === 0 ? "Graph build finished." : "Graph build returned a notice — open the Command Centre log.");
      },
    });
    this.addCommand({
      id: "update-graph",
      name: "Update knowledge graph (incremental)",
      callback: async () => {
        new Notice("Updating graph…");
        const r = await this.runner.graphUpdate();
        new Notice(r.code === 0 ? "Graph update finished." : "Graph update needs attention — open the Command Centre log.");
      },
    });
    this.addCommand({
      id: "federate",
      name: "Federate all wikis (merge graphs)",
      callback: async () => {
        new Notice("Federating…");
        const r = await this.runner.federateUpdate();
        new Notice(r.code === 0 ? "Federation finished." : "Federation returned a notice — open the Command Centre log.");
      },
    });

    this.addSettingTab(new CommandCentreSettingTab(this.app, this));
  }

  onunload(): void {
    // Obsidian detaches leaves of our view type automatically on unload.
  }

  rebuildRunner(): void {
    this.runner = new Runner(this.scriptsDir(), this.settings.graphifyBin);
  }

  /** Directory that holds the wiki-*.sh scripts (and graph/). Defaults to the vault root. */
  scriptsDir(): string {
    return this.settings.scriptsDir || this.vaultBasePath();
  }

  vaultBasePath(): string {
    const adapter = this.app.vault.adapter;
    if (adapter instanceof FileSystemAdapter) return adapter.getBasePath();
    return "";
  }

  async activateView(): Promise<void> {
    const { workspace } = this.app;
    let leaf = workspace.getLeavesOfType(VIEW_TYPE_CC)[0];
    if (!leaf) {
      leaf = workspace.getLeaf(true);
      await leaf.setViewState({ type: VIEW_TYPE_CC, active: true });
    }
    workspace.revealLeaf(leaf);
  }

  async loadSettings(): Promise<void> {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
    this.rebuildRunner();
  }
}
