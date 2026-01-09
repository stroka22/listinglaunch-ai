import { ListingWorkspace } from "@/components/workspace/ListingWorkspace";

interface PageProps {
  params: { id: string };
}

export default function ListingWorkspacePage({ params }: PageProps) {
  return <ListingWorkspace listingId={params.id} />;
}
