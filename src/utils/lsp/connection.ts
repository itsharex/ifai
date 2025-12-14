import {
  AbstractMessageReader,
  AbstractMessageWriter,
  Message,
  DataCallback,
  Disposable
} from 'vscode-jsonrpc';
import { invoke } from '@tauri-apps/api/core';
import { listen, UnlistenFn } from '@tauri-apps/api/event';

export class TauriMessageReader extends AbstractMessageReader {
  private unlisten: UnlistenFn | undefined;

  constructor(private languageId: string) {
    super();
  }

  listen(callback: DataCallback): Disposable {
    const eventName = `lsp-msg-${this.languageId}`;
    
    // Tauri's listen returns a Promise<UnlistenFn>, but listen() here must return Disposable synchronously.
    // So we handle subscription asynchronously but provide dispose immediately.
    let unlistener: UnlistenFn | null = null;
    
    listen<string>(eventName, (event) => {
      try {
        const msg = JSON.parse(event.payload);
        callback(msg);
      } catch (e) {
        console.error('Failed to parse LSP message', e);
      }
    }).then(u => {
        unlistener = u;
        this.unlisten = u;
    });

    return {
      dispose: () => {
        if (unlistener) unlistener();
      }
    };
  }
}

export class TauriMessageWriter extends AbstractMessageWriter {
  constructor(private languageId: string) {
    super();
  }

  async write(msg: Message): Promise<void> {
    try {
      const str = JSON.stringify(msg);
      await invoke('send_lsp_message', { languageId: this.languageId, message: str });
    } catch (e) {
      console.error('Failed to send LSP message', e);
    }
  }
  
  end(): void {}
}
