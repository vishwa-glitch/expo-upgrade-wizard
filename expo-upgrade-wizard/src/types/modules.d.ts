declare module 'update-notifier' {
  interface Package {
    name: string;
    version: string;
  }

  interface NotifierOptions {
    pkg: Package;
    updateCheckInterval?: number;
  }

  interface UpdateInfo {
    current: string;
    latest: string;
  }

  interface Notifier {
    update?: UpdateInfo;
    notify(customMessage?: any): void;
  }

  function updateNotifier(options: NotifierOptions): Notifier;
  export = updateNotifier;
}

declare module 'cli-table3' {
  class Table {
    constructor(options?: any);
    push(...args: any[]): void;
    toString(): string;
  }
  export = Table;
}

declare module '@babel/traverse' {
  const traverse: any;
  export default traverse;
}

declare module '@babel/generator' {
  const generate: any;
  export default generate;
}

declare module 'simple-git' {
  export interface SimpleGit {
    revparse(args: string[]): Promise<string>;
    status(): Promise<StatusResult>;
    stash(args: string[]): Promise<void>;
    checkoutBranch(branch: string, startPoint: string): Promise<void>;
    add(files: string): Promise<void>;
    commit(message: string): Promise<void>;
    diff(args: string[]): Promise<string>;
    checkout(branch: string): Promise<void>;
    init(): Promise<void>;
  }

  export interface StatusResult {
    isClean(): boolean;
    modified: string[];
    created: string[];
    deleted: string[];
    renamed: { from: string; to: string }[];
  }

  export function simpleGit(basePath?: string): SimpleGit;
}
