import { Modal } from "../../ui_comps/modal";
import type { InHouseCrew } from "../../interfaces/inHouseCrew";
import { CrewJoinLinkSection } from "./CrewJoinLinkSection";
import { CrewPeopleSection } from "./CrewPeopleSection";

interface CrewAccessModalProps {
  crew: InHouseCrew;
  onClose: () => void;
}

/** One place for who is in a crew and how they get in (Phase 13f-join): the
 *  people with a Remove for each, and the crew's open join link / QR. */
export const CrewAccessModal = ({ crew, onClose }: CrewAccessModalProps) => (
  <Modal isOpen onClose={onClose} title={`${crew.name}: people and join link`}>
    <CrewPeopleSection crew={crew} />
    <CrewJoinLinkSection crew={crew} />
  </Modal>
);
