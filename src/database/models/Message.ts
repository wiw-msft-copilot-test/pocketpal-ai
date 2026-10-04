import {Model} from '@nozbe/watermelondb';
import {field, text} from '@nozbe/watermelondb/decorators';
import {MessageType} from '../../utils/types';
import {decodeStoredMessage} from './messageDecoder';

export default class Message extends Model {
  static table = 'messages';

  static associations = {
    chat_sessions: {type: 'belongs_to' as const, key: 'session_id'},
  };

  @text('session_id') sessionId!: string;
  @text('author') author!: string;
  @text('text') text?: string;
  @text('type') type!: string;
  @field('created_at') createdAt!: number;
  @field('metadata') metadata!: string;
  @field('position') position!: number;

  toMessageObject(): MessageType.Any {
    return decodeStoredMessage({
      id: this.id,
      author: this.author,
      type: this.type,
      text: this.text,
      createdAt: this.createdAt,
      metadata: this.metadata,
    });
  }
}
