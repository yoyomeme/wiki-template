import { spawn } from "child_process";

export interface RunResult {
  code: number;
  stdout: string;
  stderr: string;
}

/**
 * Run a command and capture output. Desktop-only (uses Node child_process).
 * Never invoked on mobile — the plugin is isDesktopOnly.
 */
export function run(cmd: string, args: string[], cwd: string): Promise<RunResult> {
  return new Promise((resolve) => {
    let stdout = "";
    let stderr = "";
    let child;
    try {
      child = spawn(cmd, args, { cwd, shell: false });
    } catch (e) {
      resolve({ code: -1, stdout: "", stderr: String(e) });
      return;
    }
    child.stdout?.on("data", (d) => (stdout += d.toString()));
    child.stderr?.on("data", (d) => (stderr += d.toString()));
    child.on("error", (e) => resolve({ code: -1, stdout, stderr: stderr + String(e) }));
    child.on("close", (code) => resolve({ code: code ?? -1, stdout, stderr }));
  });
}

// The scripts directory comes from plugin settings (or the vault path). It is used to build
// the path of the script bash executes, so reject empty or shell-metacharacter values — a
// defense against a tampered/poisoned settings file pointing bash at an attacker's script.
// (Question text and registry values are never interpolated into a shell string; spawn uses
// shell:false and wiki-graph.sh quotes "$q".)
const SAFE_DIR = /^[A-Za-z0-9 _./~-]+$/;

export class Runner {
  constructor(private scriptsDir: string, private graphifyBin: string) {}

  private dirOk(): boolean {
    return this.scriptsDir.length > 0 && SAFE_DIR.test(this.scriptsDir);
  }

  private sh(script: string, args: string[]): Promise<RunResult> {
    if (!this.dirOk()) {
      return Promise.resolve({
        code: -1,
        stdout: "",
        stderr: `Scripts directory is empty or contains unsafe characters: "${this.scriptsDir}". Set a valid absolute path in the plugin settings.`,
      });
    }
    return run("bash", [`${this.scriptsDir}/${script}`, ...args], this.scriptsDir);
  }

  graphStatus(): Promise<RunResult> {
    return this.sh("wiki-graph.sh", ["status", "--json"]);
  }
  graphBuild(): Promise<RunResult> {
    return this.sh("wiki-graph.sh", ["build"]);
  }
  graphUpdate(): Promise<RunResult> {
    return this.sh("wiki-graph.sh", ["update"]);
  }
  graphRefresh(): Promise<RunResult> {
    return this.sh("wiki-graph.sh", ["refresh"]);
  }
  federateStatus(): Promise<RunResult> {
    return this.sh("wiki-federate.sh", ["status", "--json"]);
  }
  federateUpdate(): Promise<RunResult> {
    return this.sh("wiki-federate.sh", ["update"]);
  }
  federateBuild(): Promise<RunResult> {
    return this.sh("wiki-federate.sh", ["build"]);
  }

  /**
   * Run a natural-language query against the built graph. Delegated to wiki-graph.sh, which
   * runs `graphify query` from the directory where graphify-out/graph.json lives.
   */
  query(question: string): Promise<RunResult> {
    return this.sh("wiki-graph.sh", ["query", question]);
  }
}
