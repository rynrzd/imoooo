"use client";

import { AddDocumentDialog } from "@/components/documents/add-document-dialog";
import { DocumentLibrary } from "@/components/documents/document-library";
import { PageHeader } from "@/components/layout/page-header";
import { useAppStore } from "@/lib/store";

export default function DocumentsPage() {
  const { data } = useAppStore();

  return (
    <>
      <PageHeader
        title="Documents"
        description={`${data.documents.length} document${data.documents.length > 1 ? "s" : ""} dans votre bibliothèque`}
      >
        <AddDocumentDialog />
      </PageHeader>

      <DocumentLibrary />
    </>
  );
}
