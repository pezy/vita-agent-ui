import { StreamChunk, MessageBlock } from '../types';
import { UIEvent } from '../schemas';


export class StreamParser {
    private buffer: string = '';
    private blocks: MessageBlock[] = [];
    private currentThinkingBlock: Extract<MessageBlock, { type: 'text' }> | null = null;
    private currentTextBlock: Extract<MessageBlock, { type: 'text' }> | null = null;

    public get isThinking(): boolean {
        return this.currentThinkingBlock !== null;
    }

    public ttsState: { isSpeaking: boolean; text?: string; provider?: string } = { isSpeaking: false };


    processChunk(chunk: StreamChunk): MessageBlock[] {
        if ('type' in chunk) {
            if (chunk.type === 'token') {
                this.buffer += chunk.content;
                this.processBuffer();
            } else if (chunk.type === 'tool_call') {
                // Legacy support for full tool_call
                this.finalizeCurrentBlocks();
                this.blocks.push({
                    type: 'tool_call',
                    name: chunk.name,
                    args: chunk.args,
                    id: chunk.id,
                    rawArgs: JSON.stringify(chunk.args)
                });
            } else if (chunk.type === 'tool_call_chunk') {
                this.finalizeCurrentBlocks();
                let toolBlock;

                if (chunk.id) {
                    toolBlock = this.blocks.find(b => b.type === 'tool_call' && b.id === chunk.id);
                } else {
                    // If ID is missing, try to attach to the most recent tool call
                    const lastBlock = this.blocks[this.blocks.length - 1];
                    if (lastBlock && lastBlock.type === 'tool_call') {
                        toolBlock = lastBlock;
                    }
                }

                if (!toolBlock) {
                    // New tool call starting
                    // NOTE: First chunk should contain the name
                    toolBlock = {
                        type: 'tool_call' as const,
                        name: chunk.name || 'unknown_tool',
                        args: {},
                        id: chunk.id || '',
                        rawArgs: ''
                    };
                    this.blocks.push(toolBlock);
                }

                // Append args chunk if present
                if (chunk.args) {
                    // Ensure rawArgs is initialized
                    if (toolBlock.type === 'tool_call') {
                        if (!toolBlock.rawArgs) toolBlock.rawArgs = '';
                        toolBlock.rawArgs += chunk.args;

                        try {
                            toolBlock.args = JSON.parse(toolBlock.rawArgs);
                        } catch (e) {
                            // ignore
                        }
                    }
                }
            } else if (chunk.type === 'tool_result') {
                const toolBlock = this.blocks.find(b => b.type === 'tool_call' && b.id === chunk.id);
                if (toolBlock && toolBlock.type === 'tool_call') {
                    toolBlock.result = chunk.result;
                }
            } else if (chunk.type === 'user_request') {
                this.finalizeCurrentBlocks();
                this.blocks.push({
                    type: 'user_request',
                    content: chunk.content
                });
            } else if (chunk.type === 'system') {
                this.finalizeCurrentBlocks();
                this.blocks.push({
                    type: 'system',
                    content: chunk.content
                });
            } else if (chunk.type === 'ui_event') {
                // Handle Custom UI Events
                const event = chunk.event;
                if (event.event_type === 'tts_start') {
                    this.ttsState = { isSpeaking: true, text: event.text, provider: event.provider };
                } else if (event.event_type === 'tts_end') {
                    this.ttsState = { isSpeaking: false };
                } else if (event.event_type.startsWith('vision_')) {
                    // Attach to last vision tool call
                    for (let i = this.blocks.length - 1; i >= 0; i--) {
                        const block = this.blocks[i];
                        if (block.type === 'tool_call' && block.name === 'vision_analyze') {
                            if (!block.events) block.events = [];
                            block.events.push(event);
                            break;
                        }
                    }
                }
            }
        }
        return [...this.blocks];
    }

    private processBuffer() {
        while (true) {
            if (this.currentThinkingBlock) {
                // We are inside a thinking block. Look for the corresponding closing tag.
                const currentTag = this.currentThinkingBlock.thinkingTag || 'thinking';
                const closingTag = `</${currentTag}>`;
                const closingIndex = this.buffer.indexOf(closingTag);

                if (closingIndex !== -1) {
                    // Found closing tag
                    const content = this.buffer.substring(0, closingIndex);
                    this.currentThinkingBlock.content += content;
                    this.currentThinkingBlock = null; // Close thinking block

                    // Advance buffer past the closing tag
                    this.buffer = this.buffer.substring(closingIndex + closingTag.length);
                    // Loop continues to process remaining buffer
                } else {
                    // No closing tag found in this buffer
                    this.currentThinkingBlock.content += this.buffer;
                    this.buffer = '';
                    break; // Done with this buffer
                }
            } else {
                // We are in normal text. Look for any opening tag.
                const tags = ['thinking', 'think', 'reasoning'];
                let firstTagIndex = -1;
                let foundTag = '';

                for (const tag of tags) {
                    const openTag = `<${tag}>`;
                    const idx = this.buffer.indexOf(openTag);
                    if (idx !== -1) {
                        if (firstTagIndex === -1 || idx < firstTagIndex) {
                            firstTagIndex = idx;
                            foundTag = tag;
                        }
                    }
                }

                if (firstTagIndex !== -1) {
                    // Found an opening tag
                    // Content before the tag is normal text
                    if (firstTagIndex > 0) {
                        const text = this.buffer.substring(0, firstTagIndex);
                        this.appendToTextBlock(text, false);
                    }

                    // Start new thinking block
                    this.currentThinkingBlock = {
                        type: 'text',
                        content: '',
                        isThinking: true,
                        thinkingTag: foundTag
                    };
                    this.blocks.push(this.currentThinkingBlock);

                    // Advance buffer past the opening tag
                    this.buffer = this.buffer.substring(firstTagIndex + foundTag.length + 2); // +2 for < and >
                    // Loop continues
                } else {
                    // No opening tag found
                    this.appendToTextBlock(this.buffer, false);
                    this.buffer = '';
                    break; // Done
                }
            }
        }
    }

    private appendToTextBlock(text: string, isThinking: boolean) {
        if (!text) return;

        // If we have a current text block, append to it
        if (this.currentTextBlock && !this.currentTextBlock.isThinking) {
            this.currentTextBlock.content += text;
        } else {
            // Ignore whitespace-only text when starting a new block to avoid empty bubbles
            if (text.trim().length === 0) return;

            // Create new text block
            this.currentTextBlock = { type: 'text', content: text, isThinking: false };
            this.blocks.push(this.currentTextBlock);
        }
    }

    private finalizeCurrentBlocks() {
        this.currentThinkingBlock = null;
        this.currentTextBlock = null;
    }
}
