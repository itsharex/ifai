import { useEffect, useRef } from 'react';
import { TauriMessageReader, TauriMessageWriter } from '../utils/lsp/connection';
import { createMessageConnection, CloseAction, ErrorAction } from 'vscode-jsonrpc';
import { MonacoLanguageClient } from 'monaco-languageclient';
import { invoke } from '@tauri-apps/api/core';

export const useLsp = (languageId: string, cmd: string, args: string[]) => {
    const clientRef = useRef<MonacoLanguageClient | null>(null);

    useEffect(() => {
        const startLsp = async () => {
            try {
                // 1. Start Backend Process
                console.log(`Starting LSP for ${languageId}...`);
                await invoke('start_lsp', { languageId, cmd, args });

                // 2. Create RPC Connection
                const reader = new TauriMessageReader(languageId);
                const writer = new TauriMessageWriter(languageId);
                const connection = createMessageConnection(reader, writer);

                // 3. Create Monaco Language Client
                // Note: MonacoLanguageClient expects the environment to have VSCode services initialized.
                // If this fails, we might need to use a simpler wrapper or initServices.
                const client = new MonacoLanguageClient({
                    name: `${languageId} Language Client`,
                    clientOptions: {
                        documentSelector: [languageId], // 'typescript', 'javascript'
                        errorHandler: {
                            error: () => ({ action: ErrorAction.Continue }),
                            closed: () => ({ action: CloseAction.DoNotRestart }),
                        },
                    },
                    connectionProvider: {
                        get: async () => {
                            return connection;
                        }
                    }
                });

                client.start();
                clientRef.current = client;
                console.log(`LSP Client for ${languageId} started.`);

            } catch (e) {
                console.error(`Failed to start LSP for ${languageId}:`, e);
            }
        };

        // Only start if not already started? 
        // For simplicity, start once on mount.
        startLsp();

        return () => {
             console.log(`Stopping LSP for ${languageId}...`);
             if (clientRef.current) {
                 clientRef.current.stop();
             }
             invoke('kill_lsp', { languageId }).catch(console.error);
        };
    }, []); // Run once
};
