import { generateUUID } from '@/lib/utils';
import { DataStreamWriter, tool } from 'ai';
import { z } from 'zod';
import { Session } from 'next-auth';
import {
  artifactKinds,
  documentHandlersByArtifactKind,
} from '@/lib/artifacts/server';

interface CreateDocumentProps {
  session: Session;
  dataStream: DataStreamWriter;
}

export const createDocument = ({ session, dataStream }: CreateDocumentProps) =>
  tool({
    description:
      'Create a document for a writing or content creation activities. This tool will call other functions that will generate the contents of the document based on the title and kind.',
    parameters: z.object({
      title: z.string(),
      kind: z.enum(artifactKinds),
    }),
    execute: async ({ title, kind }) => {
      try {
        const id = generateUUID();

        dataStream.writeData({
          type: 'kind',
          content: kind,
        });

        dataStream.writeData({
          type: 'id',
          content: id,
        });

        dataStream.writeData({
          type: 'title',
          content: title,
        });

        dataStream.writeData({
          type: 'clear',
          content: '',
        });

        const documentHandler = documentHandlersByArtifactKind.find(
          (documentHandlerByArtifactKind) =>
            documentHandlerByArtifactKind.kind === kind,
        );

        if (!documentHandler) {
          return {
            error: `No document handler found for kind: ${kind}`,
            message: 'I couldn\'t create that document type. Let\'s try something else.'
          };
        }

        try {
          await documentHandler.onCreateDocument({
            id,
            title,
            dataStream,
            session,
          });

          dataStream.writeData({ type: 'finish', content: '' });

          return {
            id,
            title,
            kind,
            content: 'A document was created and is now visible to the user.',
          };
        } catch (handlerError) {
          console.error('Document handler error:', handlerError);
          return {
            error: 'Failed to create document',
            message: 'I had trouble creating that document. Let\'s try a different approach.'
          };
        }
      } catch (error) {
        console.error('Error in createDocument tool:', error);
        return {
          error: 'Failed to create document',
          message: 'I encountered an issue when trying to create documents. How else can I help you?'
        };
      }
    },
  });
