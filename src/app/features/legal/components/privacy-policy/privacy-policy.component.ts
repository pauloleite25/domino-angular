import { Component } from '@angular/core';

type PrivacySection = {
  readonly title: string;
  readonly paragraphs: readonly string[];
  readonly items?: readonly string[];
};

@Component({
  selector: 'app-privacy-policy',
  templateUrl: './privacy-policy.component.html',
  styleUrl: './privacy-policy.component.scss'
})
export class PrivacyPolicyComponent {
  // Substituir pelo e-mail real de suporte antes da publicação.
  readonly supportEmail = 'suporte@seudominio.com';
  readonly lastUpdated = '13 de maio de 2026';

  readonly collectedData = [
    'apelido ou nickname do jogador, quando informado;',
    'informações de partidas, salas de jogo e progresso necessário para a experiência;',
    'pontuação e ranking, quando esses recursos estiverem disponíveis;',
    'dados técnicos de funcionamento, como logs de erro, desempenho e informações básicas do dispositivo, quando usados para diagnóstico e correção de falhas;',
    'dados de conexão necessários para comunicação com o servidor ou backend, quando houver partidas online.'
  ] as const;

  readonly nonSensitiveData = [
    'localização precisa;',
    'contatos;',
    'fotos;',
    'câmera;',
    'microfone;',
    'dados bancários;',
    'documentos pessoais.'
  ] as const;

  readonly usageData = [
    'permitir o funcionamento do jogo;',
    'identificar o jogador dentro de salas ou partidas;',
    'registrar pontuações e rankings;',
    'melhorar estabilidade e desempenho;',
    'corrigir erros e falhas.'
  ] as const;

  readonly sections: readonly PrivacySection[] = [
    {
      title: '1. Informações coletadas',
      paragraphs: [
        'Esta Política de Privacidade descreve como este aplicativo de jogo de dominó coleta, utiliza, armazena e protege as informações dos usuários.',
        'O aplicativo pode coletar apenas dados necessários para o funcionamento do jogo.'
      ],
      items: this.collectedData
    },
    {
      title: '2. Dados não coletados',
      paragraphs: [
        'O aplicativo não coleta dados sensíveis para operar suas funcionalidades atuais.'
      ],
      items: this.nonSensitiveData
    },
    {
      title: '3. Uso das informações',
      paragraphs: [
        'As informações coletadas podem ser utilizadas para manter o jogo disponível, funcional e estável.'
      ],
      items: this.usageData
    },
    {
      title: '4. Armazenamento e serviços técnicos',
      paragraphs: [
        'Os dados podem ser armazenados em servidores próprios ou em serviços de terceiros utilizados para hospedagem, infraestrutura, operação online, análise técnica, relatórios de falhas ou outros recursos essenciais ao funcionamento do aplicativo.',
        'Esta página não presume o uso de um fornecedor específico. Caso o projeto passe a utilizar serviços externos adicionais, eles poderão tratar dados de acordo com suas próprias políticas de privacidade.'
      ]
    },
    {
      title: '5. Compartilhamento de dados',
      paragraphs: [
        'Os dados dos usuários não são vendidos.',
        'As informações só podem ser compartilhadas quando isso for necessário para o funcionamento do app, para o cumprimento de obrigações legais, para prevenção de fraudes ou para o uso de serviços técnicos essenciais.'
      ]
    },
    {
      title: '6. Segurança',
      paragraphs: [
        'Adotamos medidas razoáveis para proteger as informações contra acesso não autorizado, alteração, divulgação ou destruição indevida.',
        'Ainda assim, nenhum sistema eletrônico ou transmissão pela internet é 100% seguro, e não é possível garantir segurança absoluta.'
      ]
    },
    {
      title: '7. Direitos do usuário',
      paragraphs: [
        'O usuário pode solicitar acesso, correção ou exclusão de dados pessoais, quando aplicável, entrando em contato pelo e-mail de suporte informado nesta política.'
      ]
    },
    {
      title: '8. Crianças e menores de idade',
      paragraphs: [
        'O aplicativo não tem como objetivo coletar intencionalmente dados pessoais de crianças.',
        'Caso seja identificado que informações pessoais de menores foram coletadas de forma inadequada, o usuário ou responsável poderá entrar em contato para solicitar a remoção.'
      ]
    },
    {
      title: '9. Alterações nesta política',
      paragraphs: [
        'Esta Política de Privacidade pode ser atualizada periodicamente para refletir mudanças no aplicativo, requisitos legais ou melhorias nos processos de privacidade.',
        'A data da última atualização será sempre informada nesta página.'
      ]
    },
    {
      title: '10. Contato',
      paragraphs: [
        'Em caso de dúvidas, solicitações ou reclamações relacionadas a esta Política de Privacidade, entre em contato pelo e-mail de suporte abaixo.'
      ]
    }
  ];
}
