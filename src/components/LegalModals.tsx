import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { ScrollArea } from './ui/scroll-area';
import { Separator } from './ui/separator';

export type LegalModalType = 'terms' | 'privacy' | 'lgpd' | 'changelog' | null;

interface LegalModalsProps {
  open: LegalModalType;
  onOpenChange: (open: LegalModalType) => void;
}

export function LegalModals({ open, onOpenChange }: LegalModalsProps) {
  const closeModal = () => onOpenChange(null);

  return (
    <>
      {/* Terms of Use Modal */}
      <Dialog open={open === 'terms'} onOpenChange={() => closeModal()}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Termos de Uso</DialogTitle>
          </DialogHeader>
          <ScrollArea className="h-96 pr-4">
            <div className="space-y-4 text-sm">
              <div>
                <h4 className="text-base mb-2">1. Aceitação dos Termos</h4>
                <p className="text-muted-foreground leading-relaxed">
                  Ao acessar e usar o Tio Tor, você concorda em cumprir estes Termos de Uso. 
                  Se você não concordar com algum destes termos, não deve usar nosso serviço.
                </p>
              </div>

              <Separator />

              <div>
                <h4 className="text-base mb-2">2. Descrição do Serviço</h4>
                <p className="text-muted-foreground leading-relaxed">
                  O Tio Tor é um coach de entrevistas baseado em inteligência artificial que oferece 
                  sessões de prática por voz para ajudar usuários a se prepararem para entrevistas de trabalho.
                </p>
              </div>

              <Separator />

              <div>
                <h4 className="text-base mb-2">3. Uso Aceitável</h4>
                <p className="text-muted-foreground leading-relaxed mb-2">
                  Você concorda em usar o serviço apenas para:
                </p>
                <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-4">
                  <li>Praticar e melhorar suas habilidades de entrevista</li>
                  <li>Fins educacionais e de desenvolvimento profissional</li>
                  <li>Uso pessoal e não comercial</li>
                </ul>
              </div>

              <Separator />

              <div>
                <h4 className="text-base mb-2">4. Conta de Usuário</h4>
                <p className="text-muted-foreground leading-relaxed">
                  Você é responsável por manter a confidencialidade de sua conta e senha. 
                  Notifique-nos imediatamente sobre qualquer uso não autorizado de sua conta.
                </p>
              </div>

              <Separator />

              <div>
                <h4 className="text-base mb-2">5. Propriedade Intelectual</h4>
                <p className="text-muted-foreground leading-relaxed">
                  Todo o conteúdo, software e materiais do Tio Tor são protegidos por direitos autorais 
                  e outras leis de propriedade intelectual.
                </p>
              </div>

              <Separator />

              <div>
                <h4 className="text-base mb-2">6. Limitação de Responsabilidade</h4>
                <p className="text-muted-foreground leading-relaxed">
                  O Tio Tor não garante resultados específicos em entrevistas reais. 
                  Nosso serviço é apenas para fins de prática e desenvolvimento.
                </p>
              </div>

              <Separator />

              <div>
                <h4 className="text-base mb-2">7. Modificações</h4>
                <p className="text-muted-foreground leading-relaxed">
                  Reservamo-nos o direito de modificar estes termos a qualquer momento. 
                  As alterações entrarão em vigor imediatamente após a publicação.
                </p>
              </div>

              <div className="mt-6 p-3 bg-muted rounded-md">
                <p className="text-xs text-muted-foreground">
                  Última atualização: 12 de setembro de 2025
                </p>
              </div>
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Privacy Policy Modal */}
      <Dialog open={open === 'privacy'} onOpenChange={() => closeModal()}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Política de Privacidade</DialogTitle>
          </DialogHeader>
          <ScrollArea className="h-96 pr-4">
            <div className="space-y-4 text-sm">
              <div>
                <h4 className="text-base mb-2">1. Informações que Coletamos</h4>
                <p className="text-muted-foreground leading-relaxed mb-2">
                  Coletamos as seguintes informações:
                </p>
                <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-4">
                  <li>Informações de conta (email, nome)</li>
                  <li>Dados de sessões de prática</li>
                  <li>Gravações de áudio para análise (processadas localmente)</li>
                  <li>Estatísticas de progresso e pontuações</li>
                </ul>
              </div>

              <Separator />

              <div>
                <h4 className="text-base mb-2">2. Como Usamos suas Informações</h4>
                <p className="text-muted-foreground leading-relaxed mb-2">
                  Suas informações são usadas para:
                </p>
                <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-4">
                  <li>Fornecer e melhorar nossos serviços</li>
                  <li>Acompanhar seu progresso de aprendizado</li>
                  <li>Personalizar a experiência de coaching</li>
                  <li>Comunicar atualizações importantes</li>
                </ul>
              </div>

              <Separator />

              <div>
                <h4 className="text-base mb-2">3. Proteção de Dados</h4>
                <p className="text-muted-foreground leading-relaxed">
                  Implementamos medidas de segurança técnicas e organizacionais para proteger 
                  seus dados pessoais contra acesso não autorizado, alteração, divulgação ou destruição.
                </p>
              </div>

              <Separator />

              <div>
                <h4 className="text-base mb-2">4. Compartilhamento de Dados</h4>
                <p className="text-muted-foreground leading-relaxed">
                  Não vendemos, trocamos ou transferimos suas informações pessoais para terceiros, 
                  exceto conforme descrito nesta política ou quando exigido por lei.
                </p>
              </div>

              <Separator />

              <div>
                <h4 className="text-base mb-2">5. Cookies e Tecnologias Similares</h4>
                <p className="text-muted-foreground leading-relaxed">
                  Utilizamos cookies e tecnologias similares para melhorar sua experiência, 
                  analisar o uso do serviço e personalizar conteúdo.
                </p>
              </div>

              <Separator />

              <div>
                <h4 className="text-base mb-2">6. Seus Direitos</h4>
                <p className="text-muted-foreground leading-relaxed mb-2">
                  Você tem o direito de:
                </p>
                <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-4">
                  <li>Acessar seus dados pessoais</li>
                  <li>Corrigir informações imprecisas</li>
                  <li>Solicitar a exclusão de seus dados</li>
                  <li>Retirar o consentimento</li>
                </ul>
              </div>

              <div className="mt-6 p-3 bg-muted rounded-md">
                <p className="text-xs text-muted-foreground">
                  Para exercer seus direitos, entre em contato conosco através de iverson.ux@gmail.com
                </p>
              </div>
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* LGPD Modal */}
      <Dialog open={open === 'lgpd'} onOpenChange={() => closeModal()}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Lei Geral de Proteção de Dados (LGPD)</DialogTitle>
          </DialogHeader>
          <ScrollArea className="h-96 pr-4">
            <div className="space-y-4 text-sm">
              <div>
                <h4 className="text-base mb-2">Conformidade com a LGPD</h4>
                <p className="text-muted-foreground leading-relaxed">
                  O Tio Tor está comprometido em cumprir a Lei Geral de Proteção de Dados (Lei nº 13.709/2018) 
                  e garantir a proteção dos dados pessoais de nossos usuários.
                </p>
              </div>

              <Separator />

              <div>
                <h4 className="text-base mb-2">Base Legal para Tratamento</h4>
                <p className="text-muted-foreground leading-relaxed mb-2">
                  Tratamos seus dados pessoais com base nas seguintes hipóteses legais:
                </p>
                <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-4">
                  <li>Consentimento do titular (Art. 7º, I)</li>
                  <li>Execução de contrato (Art. 7º, V)</li>
                  <li>Legítimo interesse (Art. 7º, IX)</li>
                  <li>Proteção do crédito (Art. 7º, X)</li>
                </ul>
              </div>

              <Separator />

              <div>
                <h4 className="text-base mb-2">Direitos do Titular</h4>
                <p className="text-muted-foreground leading-relaxed mb-2">
                  Conforme o Art. 18 da LGPD, você tem direito a:
                </p>
                <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-4">
                  <li>Confirmação da existência de tratamento</li>
                  <li>Acesso aos dados</li>
                  <li>Correção de dados incompletos, inexatos ou desatualizados</li>
                  <li>Anonimização, bloqueio ou eliminação de dados</li>
                  <li>Portabilidade dos dados</li>
                  <li>Eliminação dos dados tratados com consentimento</li>
                  <li>Informação sobre compartilhamento</li>
                  <li>Revogação do consentimento</li>
                </ul>
              </div>

              <Separator />

              <div>
                <h4 className="text-base mb-2">Encarregado de Dados</h4>
                <p className="text-muted-foreground leading-relaxed">
                  Nossa equipe de proteção de dados é responsável por atender solicitações relacionadas 
                  à LGPD e pode ser contatada através do email: iverson.ux@gmail.com
                </p>
              </div>

              <Separator />

              <div>
                <h4 className="text-base mb-2">Segurança dos Dados</h4>
                <p className="text-muted-foreground leading-relaxed">
                  Adotamos medidas técnicas e administrativas aptas a proteger os dados pessoais 
                  de acessos não autorizados e de situações acidentais ou ilícitas de destruição, 
                  perda, alteração, comunicação ou difusão.
                </p>
              </div>

              <Separator />

              <div>
                <h4 className="text-base mb-2">Violação de Dados</h4>
                <p className="text-muted-foreground leading-relaxed">
                  Em caso de incidente de segurança que possa acarretar risco ou dano relevante aos titulares, 
                  notificaremos a Autoridade Nacional de Proteção de Dados (ANPD) e os titulares afetados 
                  conforme previsto na lei.
                </p>
              </div>

              <div className="mt-6 p-3 bg-muted rounded-md">
                <p className="text-xs text-muted-foreground">
                  Para exercer seus direitos ou esclarecer dúvidas sobre o tratamento de dados, 
                  entre em contato: iverson.ux@gmail.com
                </p>
              </div>
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Changelog Modal */}
      <Dialog open={open === 'changelog'} onOpenChange={() => closeModal()}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Histórico de Mudanças</DialogTitle>
          </DialogHeader>
          <ScrollArea className="h-96 pr-4">
            <div className="space-y-6 text-sm">
              {/* Version 1.2.0 */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-base">v1.2.0</span>
                  <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
                    12 Set 2025
                  </span>
                </div>
                <div className="space-y-2">
                  <div>
                    <span className="text-green-600 text-xs bg-green-50 dark:bg-green-950 px-2 py-1 rounded mr-2">
                      NOVO
                    </span>
                    <span className="text-muted-foreground">
                      Sistema completo de autenticação com Supabase
                    </span>
                  </div>
                  <div>
                    <span className="text-green-600 text-xs bg-green-50 dark:bg-green-950 px-2 py-1 rounded mr-2">
                      NOVO
                    </span>
                    <span className="text-muted-foreground">
                      Dashboard personalizado para usuários logados
                    </span>
                  </div>
                  <div>
                    <span className="text-green-600 text-xs bg-green-50 dark:bg-green-950 px-2 py-1 rounded mr-2">
                      NOVO
                    </span>
                    <span className="text-muted-foreground">
                      Histórico completo de sessões e progresso
                    </span>
                  </div>
                  <div>
                    <span className="text-blue-600 text-xs bg-blue-50 dark:bg-blue-950 px-2 py-1 rounded mr-2">
                      MELHORIA
                    </span>
                    <span className="text-muted-foreground">
                      Interface mais intuitiva e responsiva
                    </span>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Version 1.1.0 */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-base">v1.1.0</span>
                  <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
                    28 Ago 2025
                  </span>
                </div>
                <div className="space-y-2">
                  <div>
                    <span className="text-green-600 text-xs bg-green-50 dark:bg-green-950 px-2 py-1 rounded mr-2">
                      NOVO
                    </span>
                    <span className="text-muted-foreground">
                      Integração com APIs de Speech-to-Text e Text-to-Speech
                    </span>
                  </div>
                  <div>
                    <span className="text-green-600 text-xs bg-green-50 dark:bg-green-950 px-2 py-1 rounded mr-2">
                      NOVO
                    </span>
                    <span className="text-muted-foreground">
                      Sistema de pontuação automática usando IA
                    </span>
                  </div>
                  <div>
                    <span className="text-blue-600 text-xs bg-blue-50 dark:bg-blue-950 px-2 py-1 rounded mr-2">
                      MELHORIA
                    </span>
                    <span className="text-muted-foreground">
                      Feedback mais detalhado sobre as respostas
                    </span>
                  </div>
                  <div>
                    <span className="text-yellow-600 text-xs bg-yellow-50 dark:bg-yellow-950 px-2 py-1 rounded mr-2">
                      CORREÇÃO
                    </span>
                    <span className="text-muted-foreground">
                      Correção de bugs na reprodução de áudio
                    </span>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Version 1.0.0 */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-base">v1.0.0</span>
                  <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
                    15 Ago 2025
                  </span>
                </div>
                <div className="space-y-2">
                  <div>
                    <span className="text-green-600 text-xs bg-green-50 dark:bg-green-950 px-2 py-1 rounded mr-2">
                      NOVO
                    </span>
                    <span className="text-muted-foreground">
                      Lançamento inicial do Tio Tor
                    </span>
                  </div>
                  <div>
                    <span className="text-green-600 text-xs bg-green-50 dark:bg-green-950 px-2 py-1 rounded mr-2">
                      NOVO
                    </span>
                    <span className="text-muted-foreground">
                      Sistema básico de sessões de entrevista por voz
                    </span>
                  </div>
                  <div>
                    <span className="text-green-600 text-xs bg-green-50 dark:bg-green-950 px-2 py-1 rounded mr-2">
                      NOVO
                    </span>
                    <span className="text-muted-foreground">
                      Interface de onboarding e configuração
                    </span>
                  </div>
                  <div>
                    <span className="text-green-600 text-xs bg-green-50 dark:bg-green-950 px-2 py-1 rounded mr-2">
                      NOVO
                    </span>
                    <span className="text-muted-foreground">
                      Avatar animado do Tio Tor
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-6 p-3 bg-muted rounded-md">
                <p className="text-xs text-muted-foreground">
                  Acompanhe as novidades em nossa plataforma. Para sugestões ou reportar bugs, 
                  entre em contato: iverson.ux@gmail.com
                </p>
              </div>
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  );
}