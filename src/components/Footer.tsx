import React, { useState } from 'react';
import { LegalModals, LegalModalType } from './LegalModals';

interface FooterProps {
  onLogoExporter?: () => void;
}

export function Footer({ onLogoExporter }: FooterProps) {
  const currentYear = new Date().getFullYear();
  const [openModal, setOpenModal] = useState<LegalModalType>(null);

  const handleLinkClick = (modalType: LegalModalType) => {
    setOpenModal(modalType);
  };

  return (
    <>
      <footer className="border-t border-border/30 bg-background/80">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-muted-foreground/70">
            {/* Copyright */}
            <p>© {currentYear} Tio Tor. Todos os direitos reservados.</p>
            
            {/* Legal Links */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => handleLinkClick('terms')}
                className="hover:text-foreground/80 transition-colors text-xs"
              >
                Termos de Uso
              </button>
              <span className="text-muted-foreground/30">•</span>
              <button
                onClick={() => handleLinkClick('privacy')}
                className="hover:text-foreground/80 transition-colors text-xs"
              >
                Privacidade
              </button>
              <span className="text-muted-foreground/30">•</span>
              <button
                onClick={() => handleLinkClick('lgpd')}
                className="hover:text-foreground/80 transition-colors text-xs"
              >
                LGPD
              </button>
              <span className="text-muted-foreground/30">•</span>
              <button
                onClick={() => handleLinkClick('changelog')}
                className="hover:text-foreground/80 transition-colors text-xs"
              >
                Changelog
              </button>
              {onLogoExporter && (
                <>
                  <span className="text-muted-foreground/30">•</span>
                  <button
                    onClick={onLogoExporter}
                    className="hover:text-foreground/80 transition-colors text-xs"
                  >
                    Export Logo
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </footer>

      <LegalModals open={openModal} onOpenChange={setOpenModal} />
    </>
  );
}