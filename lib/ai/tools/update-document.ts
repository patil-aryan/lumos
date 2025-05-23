import { DataStreamWriter, tool } from 'ai';
import { Session } from 'next-auth';
import { z } from 'zod';
import { getDocumentById, saveDocument } from '@/lib/db/queries';
import { documentHandlersByArtifactKind } from '@/lib/artifacts/server';

interface UpdateDocumentProps {
  session: Session;
  dataStream: DataStreamWriter;
}

export const updateDocument = ({ session, dataStream }: UpdateDocumentProps) =>
  tool({
    description: 'Update a document with the given description.',
    parameters: z.object({
      id: z.string().describe('The ID of the document to update'),
      description: z
        .string()
        .describe('The description of changes that need to be made'),
    }),
    execute: async ({ id, description }) => {
      try {
        const document = await getDocumentById({ id });

        if (!document) {
          return {
            error: 'Document not found',
            message: 'I couldn\'t find that document. Could you please check the ID and try again?'
          };
        }

        dataStream.writeData({
          type: 'clear',
          content: document.title,
        });

        const documentHandler = documentHandlersByArtifactKind.find(
          (documentHandlerByArtifactKind) =>
            documentHandlerByArtifactKind.kind === document.kind,
        );

        if (!documentHandler) {
          return {
            error: `No document handler found for kind: ${document.kind}`,
            message: 'I couldn\'t process this document type. Let\'s try something else.'
          };
        }

        try {
          await documentHandler.onUpdateDocument({
            document,
            description,
            dataStream,
            session,
          });

          dataStream.writeData({ type: 'finish', content: '' });

          return {
            id,
            title: document.title,
            kind: document.kind,
            content: 'The document has been updated successfully.',
          };
        } catch (handlerError) {
          console.error('Document handler error:', handlerError);
          return {
            error: 'Failed to update document',
            message: 'I had trouble updating that document. Let\'s try a different approach.'
          };
        }
      } catch (error) {
        console.error('Error in updateDocument tool:', error);
        return {
          error: 'Failed to process document',
          message: 'I encountered an issue when trying to work with documents. How else can I help you?'
        };
      }
    },
  });
