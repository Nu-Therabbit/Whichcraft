import { createContext, useContext, useRef } from "react";
import { createWriteCoordinator, type WriteCoordinatorFacade } from "./createWriteCoordinator";

const WriteCoordinatorContext = createContext<WriteCoordinatorFacade | null>(null);

export function WriteCoordinatorProvider({
  children,
  coordinator: coordinatorOverride,
}: {
  children: React.ReactNode;
  coordinator?: WriteCoordinatorFacade;
}) {
  const coordinatorRef = useRef<WriteCoordinatorFacade | null>(null);
  if (coordinatorOverride) {
    coordinatorRef.current = coordinatorOverride;
  } else if (!coordinatorRef.current) {
    coordinatorRef.current = createWriteCoordinator();
  }
  return (
    <WriteCoordinatorContext.Provider value={coordinatorRef.current}>
      {children}
    </WriteCoordinatorContext.Provider>
  );
}

export function useWriteCoordinator(): WriteCoordinatorFacade {
  const coordinator = useContext(WriteCoordinatorContext);
  if (!coordinator) {
    throw new Error("useWriteCoordinator requires WriteCoordinatorProvider");
  }
  return coordinator;
}

/** Tests and harnesses that run outside the provider tree. */
export function createIsolatedWriteCoordinator(): WriteCoordinatorFacade {
  return createWriteCoordinator();
}
