import { prisma } from '@/server/db/client';

const SOAP_NS = 'http://schemas.xmlsoap.org/soap/envelope/';
const CWMP_NS = 'urn:dslforum-org:cwmp-1-0';
const XSD_NS  = 'http://www.w3.org/2001/XMLSchema';
const XSI_NS  = 'http://www.w3.org/2001/XMLSchema-instance';
const SOAP_ENC_NS = 'http://schemas.xmlsoap.org/soap/encoding/';

export class CwmpService {
  /**
   * Extract the text content of a simple XML element.
   */
  static xmlValue(xml: string, tag: string): string {
    const re = new RegExp(`<(?:[\\w-]+:)?${tag}[^>]*>([\\s\\S]*?)<\\/(?:[\\w-]+:)?${tag}>`, 'i');
    const m = xml.match(re);
    return m ? m[1].trim() : '';
  }

  static hasCwmpMethod(xml: string, method: string): boolean {
    const re = new RegExp(`<(?:[\\w-]+:)?${method}[\\s>]`, 'i');
    return re.test(xml);
  }

  static extractCwmpId(xml: string): string {
    const m = xml.match(/<(?:[\w-]+:)?ID[^>]*>([\s\S]*?)<\/(?:[\w-]+:)?ID>/i);
    return m ? m[1].trim() : '1';
  }

  static parseDeviceId(xml: string) {
    const deviceIdBlock = this.xmlValue(xml, 'DeviceId');
    if (!deviceIdBlock) return null;
    return {
      Manufacturer: this.xmlValue(deviceIdBlock, 'Manufacturer'),
      OUI: this.xmlValue(deviceIdBlock, 'OUI'),
      SerialNumber: this.xmlValue(deviceIdBlock, 'SerialNumber'),
      ProductClass: this.xmlValue(deviceIdBlock, 'ProductClass'),
    };
  }

  static parseParameterValues(xml: string): Record<string, string> {
    const params: Record<string, string> = {};
    const structRe = /<(?:[\w-]+:)?ParameterValueStruct>([\s\S]*?)<\/(?:[\w-]+:)?ParameterValueStruct>/gi;
    let m;
    while ((m = structRe.exec(xml)) !== null) {
      const block = m[1];
      const name = this.xmlValue(block, 'Name');
      const value = this.xmlValue(block, 'Value');
      if (name) {
        params[name] = value;
      }
    }
    return params;
  }

  static parseFault(xml: string) {
    if (!/<(?:[\w-]+:)?Fault/i.test(xml)) return null;
    return {
      faultCode: this.xmlValue(xml, 'FaultCode') || this.xmlValue(xml, 'faultcode'),
      faultString: this.xmlValue(xml, 'FaultString') || this.xmlValue(xml, 'faultstring'),
    };
  }

  // --- SOAP BUILDERS ---

  static soapEnvelopeWrap(cwmpId: string, bodyContent: string): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope
  xmlns:soap="${SOAP_NS}"
  xmlns:cwmp="${CWMP_NS}"
  xmlns:xsd="${XSD_NS}"
  xmlns:xsi="${XSI_NS}"
  xmlns:soap-enc="${SOAP_ENC_NS}">
  <soap:Header>
    <cwmp:ID soap:mustUnderstand="1">${cwmpId}</cwmp:ID>
  </soap:Header>
  <soap:Body>
    ${bodyContent}
  </soap:Body>
</soap:Envelope>`;
  }

  static buildInformResponse(cwmpId: string): string {
    return this.soapEnvelopeWrap(cwmpId,
      `<cwmp:InformResponse>
        <MaxEnvelopes>1</MaxEnvelopes>
      </cwmp:InformResponse>`
    );
  }

  static buildReboot(cwmpId: string): string {
    return this.soapEnvelopeWrap(cwmpId,
      `<cwmp:Reboot>
        <CommandKey>reboot-${Date.now()}</CommandKey>
      </cwmp:Reboot>`
    );
  }

  static buildFactoryReset(cwmpId: string): string {
    return this.soapEnvelopeWrap(cwmpId,
      `<cwmp:FactoryReset></cwmp:FactoryReset>`
    );
  }

  static buildSetParameterValues(cwmpId: string, parameterValues: Array<{name: string, value: string, type?: string}>): string {
    const pvList = parameterValues.map(pv => {
      const xsdType = pv.type || 'xsd:string';
      return `        <ParameterValueStruct>
          <Name>${this.escapeXml(pv.name)}</Name>
          <Value xsi:type="${this.escapeXml(xsdType)}">${this.escapeXml(String(pv.value))}</Value>
        </ParameterValueStruct>`;
    }).join('\n');

    const arrayType = `cwmp:ParameterValueStruct[${parameterValues.length}]`;

    return this.soapEnvelopeWrap(cwmpId,
      `<cwmp:SetParameterValues>
        <ParameterList soap-enc:arrayType="${arrayType}">
${pvList}
        </ParameterList>
        <ParameterKey>${Date.now()}</ParameterKey>
      </cwmp:SetParameterValues>`
    );
  }

  static buildGetParameterValues(cwmpId: string, parameterNames: string[]): string {
    const names = parameterNames.map(n =>
      `        <string>${this.escapeXml(n)}</string>`
    ).join('\n');

    return this.soapEnvelopeWrap(cwmpId,
      `<cwmp:GetParameterValues>
        <ParameterNames soap-enc:arrayType="xsd:string[${parameterNames.length}]">
${names}
        </ParameterNames>
      </cwmp:GetParameterValues>`
    );
  }

  static escapeXml(str: string): string {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  // --- DEVICE DB OPS ---

  static async upsertDevice(deviceId: string, deviceInfo: any, ipAddress: string) {
    const existing = await prisma.acsDevice.findUnique({ where: { serialNumber: deviceId } });
    if (existing) {
      return await prisma.acsDevice.update({
        where: { serialNumber: deviceId },
        data: {
          ipAddress,
          lastInform: new Date(),
          status: 'online'
        }
      });
    } else {
      const company = await prisma.company.findFirst();
      if (!company) throw new Error('No company found');
      return await prisma.acsDevice.create({
        data: {
          serialNumber: deviceId,
          oui: deviceInfo.OUI || '',
          productClass: deviceInfo.ProductClass || '',
          manufacturer: deviceInfo.Manufacturer || '',
          ipAddress,
          lastInform: new Date(),
          status: 'online',
          companyId: company.id
        }
      });
    }
  }

  static async getNextTask(serialNumber: string) {
    return await prisma.acsTask.findFirst({
      where: { device: { serialNumber }, status: 'pending' },
      orderBy: { createdAt: 'asc' }
    });
  }

  static async markTaskDone(taskId: string, status: string = 'success') {
    await prisma.acsTask.update({
      where: { id: taskId },
      data: { status }
    });
  }

  static async markTaskDoneWithResult(taskId: string, status: string = 'success', result: any) {
    await prisma.acsTask.update({
      where: { id: taskId },
      data: { status, result }
    });
  }

  static buildAddObject(cwmpId: string, objectName: string, parameterKey: string = ''): string {
    return this.soapEnvelopeWrap(cwmpId,
      `<cwmp:AddObject>
        <ObjectName>${this.escapeXml(objectName)}</ObjectName>
        <ParameterKey>${this.escapeXml(parameterKey)}</ParameterKey>
      </cwmp:AddObject>`
    );
  }
}
