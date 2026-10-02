; Instalador do Nexos ERP (Inno Setup 6). Gerado pelo build.py:
;
;   ISCC NexosERP.iss                 -> "Instalar-Nexos-ERP.exe": baixa a última versão do GitHub
;   ISCC /DOffline NexosERP.iss       -> "Instalar-Nexos-ERP-offline.exe": leva o programa dentro
;
; Instala só para o usuário atual (não pede senha de administrador), em
; %LOCALAPPDATA%\Programs\Nexos ERP. Os dados ficam em Documentos e não são apagados ao desinstalar.

#ifndef AppVersion
  #define AppVersion "0.0.0"
#endif
#define AppName "Nexos ERP"
#define ExeName "Nexos ERP.exe"
#define Repo "guiguimaraes08/ERP"
#define DownloadUrl "https://github.com/" + Repo + "/releases/latest/download/Nexos-ERP.exe"

[Setup]
; Nunca mude o AppId: é por ele que o Windows sabe que é o mesmo programa.
AppId={{16179F3A-8D46-454C-90F0-C9CD16038C8F}
AppName={#AppName}
AppVersion={#AppVersion}
AppVerName={#AppName}
AppPublisher={#AppName}
AppPublisherURL=https://github.com/{#Repo}
AppUpdatesURL=https://github.com/{#Repo}/releases/latest
DefaultDirName={localappdata}\Programs\Nexos ERP
DisableDirPage=yes
DisableProgramGroupPage=yes
PrivilegesRequired=lowest
UninstallDisplayName={#AppName}
UninstallDisplayIcon={app}\{#ExeName}
SetupIconFile=..\assets\icone.ico
WizardStyle=modern
WizardSizePercent=110
CloseApplications=yes
RestartApplications=no
Compression=lzma2/max
SolidCompression=yes
OutputDir=..\dist
#ifdef Offline
OutputBaseFilename=Instalar-Nexos-ERP-offline
#else
OutputBaseFilename=Instalar-Nexos-ERP
#endif

[Languages]
Name: "ptbr"; MessagesFile: "compiler:Languages\BrazilianPortuguese.isl"

[Messages]
#ifdef Offline
WelcomeLabel2=Este assistente vai instalar o [name] neste computador.%n%nNão precisa de internet.
#else
WelcomeLabel2=Este assistente vai baixar a versão mais nova do [name] e instalar neste computador.%n%nO computador precisa estar conectado à internet só agora, durante a instalação.
#endif
FinishedLabel=Pronto! O [name] está instalado.%n%nPara abrir depois, use o ícone na Área de Trabalho ou procure "Nexos" no menu Iniciar.

[Tasks]
Name: "desktopicon"; Description: "Criar um ícone na Área de Trabalho"; GroupDescription: "Atalhos:"

[Files]
#ifdef Offline
Source: "..\dist\{#ExeName}"; DestDir: "{app}"; Flags: ignoreversion
#else
; O arquivo é baixado na página "Baixando" (veja [Code]) e copiado daqui.
Source: "{tmp}\Nexos-ERP.exe"; DestDir: "{app}"; DestName: "{#ExeName}"; Flags: external ignoreversion
#endif

[Icons]
Name: "{autoprograms}\{#AppName}"; Filename: "{app}\{#ExeName}"
Name: "{autodesktop}\{#AppName}"; Filename: "{app}\{#ExeName}"; Tasks: desktopicon

[Run]
Filename: "{app}\{#ExeName}"; Description: "Abrir o {#AppName} agora"; Flags: nowait postinstall skipifsilent

[UninstallDelete]
; Sobras da atualização automática (o programa troca o próprio .exe).
Type: files; Name: "{app}\Nexos ERP.old"
Type: files; Name: "{app}\Nexos ERP.new"

#ifndef Offline
[Code]
var
  DownloadPage: TDownloadWizardPage;

procedure InitializeWizard;
begin
  DownloadPage := CreateDownloadPage('Baixando o {#AppName}', 'Pegando a versão mais nova na internet. Leva só um instante.', nil);
end;

function NextButtonClick(CurPageID: Integer): Boolean;
begin
  Result := True;
  if CurPageID <> wpReady then
    Exit;

  DownloadPage.Clear;
  DownloadPage.Add('{#DownloadUrl}', 'Nexos-ERP.exe', '');
  DownloadPage.Show;
  try
    try
      DownloadPage.Download;
    except
      if not DownloadPage.AbortedByUser then
        SuppressibleMsgBox(
          'Não consegui baixar o programa.' + #13#10#13#10 +
          'Confira se o computador está conectado à internet e tente de novo.' + #13#10#13#10 +
          '(' + GetExceptionMessage + ')',
          mbCriticalError, MB_OK, IDOK);
      Result := False;
    end;
  finally
    DownloadPage.Hide;
  end;
end;
#endif
