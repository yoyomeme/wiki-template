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

export class Runner {
  constructor(private scriptsDir: string, private graphifyBin: string) {}

  private graphScript(): string {
    return `${this.scriptsDir}/wiki-graph.sh`;
  }
  private federateScript(): string {
    return `${this.scriptsDir}/wiki-federate.sh`;
  }

  graphStatus(): Promise<RunResult> {
    return run("bash", [this.graphScript(), "status", "--json"], this.scriptsDir);
  }
  graphBuild(): Promise<RunResult> {
    return run("bash", [this.graphScript(), "build"], this.scriptsDir);
  }
  graphUpdate(): Promise<RunResult> {
    return run("bash", [this.graphScript(), "update"], this.scriptsDir);
  }
  graphRefresh(): Promise<RunResult> {
    return run("bash", [this.graphScript(), "refresh"], this.scriptsDir);
  }
  federateStatus(): Promise<RunResult> {
    return run("bash", [this.federateScript(), "status", "--json"], this.scriptsDir);
  }
  federateUpdate(): Promise<RunResult> {
    return run("bash", [this.federateScript(), "update"], this.scriptsDir);
  }
  federateBuild(): Promise<RunResult> {
    return run("bash", [this.federateScript(), "build"], this.scriptsDir);
  }

  /**
   * Run a natural-language query against the built graph. Delegated to wiki-graph.sh, which
   * runs `graphify query` from the directory where graphify-out/graph.json lives.
   */
  query(question: string): Promise<RunResult> {
    return run("bash", [this.graphScript(), "query", question], this.scriptsDir);
  }
}
