/**********************************************************************
 * Copyright (c) 2023 Red Hat, Inc.
 *
 * This program and the accompanying materials are made
 * available under the terms of the Eclipse Public License 2.0
 * which is available at https://www.eclipse.org/legal/epl-2.0/
 *
 * SPDX-License-Identifier: EPL-2.0
 ***********************************************************************/

import { inject, injectable } from "inversify";
import * as vscode from 'vscode';
import { log } from "../logger";
import * as devfile from "../devfile";
import { DevfileService } from "../devfile/devfile-service";
import { NewContainer, SaveDevfile } from "../model/extension-model";
import { countContainerComponents } from "./util";

@injectable()
export class NewContainerImpl implements NewContainer {

    @inject(DevfileService)
    private service: DevfileService;

    @inject(SaveDevfile)
    private savedevfile: SaveDevfile;

    async run(): Promise<boolean> {
        log('NewContainerImpl::run()');

        try {
            // container component image
            const containerImage = await this.defineComponentImage();
            if (!containerImage) {
                log('<< canceled');
                return false;
            }

            log(`> container image: ${containerImage}`);


            // component name
            const componentName = await this.formGenericComponentName();
            if (!componentName) {
                log('<< canceled');
                return false;
            }

            log(`> component name: ${componentName}`);

            // add new component
            if (!this.service.getDevfile().components) {
                this.service.getDevfile().components = [];
            }

            if (countContainerComponents(this.service.getDevfile()) === 0) {
                this.service.getDevfile().components.push({
                    name: componentName,
                    container: {
                        image: containerImage,
                        // set defaults
                        mountSources: true,
                        memoryRequest: '500Mi',
                        memoryLimit: '6G',
                        cpuRequest: '1000m',
                        cpuLimit: '4000m'
                    }
                });
            } else {
                this.service.getDevfile().components.push({
                    name: componentName,
                    container: {
                        image: containerImage,
                        // set defaults
                        mountSources: true
                    }
                });
            }

            // update Devfile, show a popup with proposal to open the Devfile
            await this.savedevfile.onDidDevfileUpdate(`Container '${componentName}' has been created successfully`);
            return true;
        } catch (err) {
            log(`ERROR occured: ${err.message}`);
        }

        return false;
    }

    private async formGenericComponentName(): Promise<string> {
        const devfile = this.service.getDevfile();

        let counter = 0;
        let name;
        do {
            counter++;
            name = `container-${counter}`;

            if (!devfile.components) {
                return name;
            }

        } while (devfile.components.find(c => c.name === name) !== undefined);

        return name;

    }

    private async defineComponentImage(): Promise<string | undefined> {
        log('NewContainerImpl::defineComponentImage()');

        const containerComponents = countContainerComponents(this.service.getDevfile());

        return await vscode.window.showInputBox({
            value: containerComponents === 0 ? 'quay.io/devfile/universal-developer-image:latest' : '',
            title: 'Container Image',

            validateInput: (value): string | vscode.InputBoxValidationMessage | undefined | null |
                Thenable<string | vscode.InputBoxValidationMessage | undefined | null> => {

                if (!value) {
                    return {
                        message: 'Container image cannot be empty',
                        severity: vscode.InputBoxValidationSeverity.Error
                    } as vscode.InputBoxValidationMessage;
                }

                if (this.service.getDevfile().components) {
                    for (const c of this.service.getDevfile().components) {
                        if (c.container && c.container.image === value) {
                            return {
                                message: 'Container with this image already exists',
                                severity: vscode.InputBoxValidationSeverity.Error
                            } as vscode.InputBoxValidationMessage;
                        }
                    }
                }

            }
        });
    }

    async ensureAtLeastOneContainerExist(): Promise<boolean> {
        // there should be at least one container component created
        if (countContainerComponents(this.service.getDevfile()) === 0) {
            const answer = await vscode.window.showWarningMessage('The first you need to add at least one container', 'New Container');

            if ('New Container' !== answer) {
                return false;
            }

            return await this.run();
        }

        return true;
    }


}