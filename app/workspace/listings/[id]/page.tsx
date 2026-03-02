import { GuidedWorkspace } from "@/components/workspace/GuidedWorkspace";

interface PageProps {
  params: { id: string };
}

export default function ListingWorkspacePage({ params }: PageProps) {
  return <GuidedWorkspace listingId={params.id} />;
}
